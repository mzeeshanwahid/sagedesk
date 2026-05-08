import type { SageDeskModel } from './types';

type PipelineFn = (
  text: string,
  options: { pooling: string; normalize: boolean }
) => Promise<{ data: Float32Array }>;

// Must stay in sync with embedder.ts and cli/builder-embedder.ts — same model IDs
// ensure build-time and runtime vectors share the same embedding space.
const XENOVA_IDS: Record<SageDeskModel, string> = {
  'all-MiniLM-L6-v2': 'Xenova/all-MiniLM-L6-v2',
  'bge-small-en-v1-5': 'Xenova/bge-small-en-v1.5',
  'paraphrase-multilingual-MiniLM-L12-v2': 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  'all-mpnet-base-v2': 'Xenova/all-mpnet-base-v2',
};

/**
 * Server-side embedder optimized for serverless environments (Vercel, Lambda, etc).
 * Uses pure WASM with no native ONNX Runtime dependency.
 * Models are cached at the module level to survive across serverless invocations.
 */
export class ServerEmbedder {
  private _ready = false;
  private _failed = false;
  private _model: SageDeskModel = 'all-MiniLM-L6-v2';

  // Module-level singleton cache — survives across Lambda/Vercel warm invocations
  private static _pipelineCache = new Map<SageDeskModel, PipelineFn>();
  private static _loadingPromises = new Map<SageDeskModel, Promise<void>>();

  async load(model: SageDeskModel = 'all-MiniLM-L6-v2'): Promise<void> {
    if (this._ready) return;
    if (this._failed) throw new Error('ServerEmbedder previously failed to load');

    this._model = model;

    // Return cached instance if already loaded
    if (ServerEmbedder._pipelineCache.has(model)) {
      this._ready = true;
      return;
    }

    // Return existing loading promise if currently loading
    if (ServerEmbedder._loadingPromises.has(model)) {
      await ServerEmbedder._loadingPromises.get(model)!;
      this._ready = true;
      return;
    }

    const modelId = XENOVA_IDS[model];
    const loadPromise = this._loadModel(model, modelId);
    ServerEmbedder._loadingPromises.set(model, loadPromise);

    try {
      await loadPromise;
      this._ready = true;
    } catch (err) {
      this._failed = true;
      ServerEmbedder._loadingPromises.delete(model);
      throw err;
    } finally {
      ServerEmbedder._loadingPromises.delete(model);
    }
  }

  private async _loadModel(model: SageDeskModel, modelId: string): Promise<void> {
    try {
      // device: 'cpu' is the v3.x name for the WASM/CPU backend (replaces 'wasm' from v2.x)
      const { pipeline } = await import('@huggingface/transformers');
      const pipelineInstance = (await pipeline('feature-extraction', modelId, {
        dtype: 'q8',
        device: 'cpu',
      })) as unknown as PipelineFn;

      ServerEmbedder._pipelineCache.set(model, pipelineInstance);
    } catch (err) {
      throw new Error(`Failed to load embedding model ${modelId}: ${String(err)}`);
    }
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this._ready) {
      await this.load(this._model);
    }

    const pipelineInstance = ServerEmbedder._pipelineCache.get(this._model);
    if (!pipelineInstance) {
      throw new Error(`Embedding model ${this._model} not loaded`);
    }

    try {
      const output = await pipelineInstance(text, {
        pooling: 'mean',
        normalize: true,
      });
      return output.data;
    } catch (err) {
      throw new Error(`Embedding failed: ${String(err)}`);
    }
  }

  get isReady(): boolean {
    return this._ready;
  }

  get hasFailed(): boolean {
    return this._failed;
  }

  /** @internal - Reset for testing */
  static _reset(): void {
    ServerEmbedder._pipelineCache.clear();
    ServerEmbedder._loadingPromises.clear();
  }
}
