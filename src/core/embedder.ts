import type { SageDeskModel } from './types';

type PipelineFn = (
  text: string,
  options: { pooling: string; normalize: boolean }
) => Promise<{ data: Float32Array }>;

// Maps each supported model alias to its full Xenova/HuggingFace model ID.
const XENOVA_IDS: Record<SageDeskModel, string> = {
  'all-MiniLM-L6-v2': 'Xenova/all-MiniLM-L6-v2',
  'bge-small-en-v1-5': 'Xenova/bge-small-en-v1.5',
  'paraphrase-multilingual-MiniLM-L12-v2': 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  'all-mpnet-base-v2': 'Xenova/all-mpnet-base-v2',
};

export class EmbedderRuntime {
  private _ready = false;
  private _failed = false;

  // Module-level singleton so the WASM model is loaded at most once per page,
  // regardless of how many widget instances exist.
  private static _pipelineInstance: PipelineFn | null = null;
  private static _loadingPromise: Promise<void> | null = null;

  async load(model: SageDeskModel = 'all-MiniLM-L6-v2'): Promise<void> {
    if (this._ready) return;
    if (this._failed) throw new Error('EmbedderRuntime previously failed to load');

    if (EmbedderRuntime._loadingPromise) {
      await EmbedderRuntime._loadingPromise;
      this._ready = true;
      return;
    }

    const modelId = XENOVA_IDS[model];

    EmbedderRuntime._loadingPromise = (async () => {
      try {
        const { pipeline } = await import('@huggingface/transformers');
        EmbedderRuntime._pipelineInstance = (await pipeline(
          'feature-extraction',
          modelId,
          { dtype: 'q8' }
        )) as unknown as PipelineFn;
      } catch (err) {
        EmbedderRuntime._loadingPromise = null;
        EmbedderRuntime._pipelineInstance = null;
        throw err;
      }
    })();

    try {
      await EmbedderRuntime._loadingPromise;
      this._ready = true;
    } catch (err) {
      this._failed = true;
      throw err;
    }
  }

  async embed(text: string): Promise<Float32Array> {
    if (!EmbedderRuntime._pipelineInstance) {
      await this.load();
    }

    try {
      const output = await EmbedderRuntime._pipelineInstance!(text, {
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

  /** @internal */
  static _reset(): void {
    EmbedderRuntime._pipelineInstance = null;
    EmbedderRuntime._loadingPromise = null;
  }
}
