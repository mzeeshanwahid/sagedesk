import type { SageDeskModel } from '../core/types.js';

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

export class BuilderEmbedder {
  private _pipe: PipelineFn | null = null;
  private readonly _modelId: string;

  constructor(model: SageDeskModel = 'all-MiniLM-L6-v2') {
    this._modelId = XENOVA_IDS[model];
  }

  async load(): Promise<void> {
    const { pipeline } = await import('@huggingface/transformers');
    this._pipe = (await pipeline(
      'feature-extraction',
      this._modelId,
      { dtype: 'q8' }
    )) as unknown as PipelineFn;
  }

  async embed(text: string): Promise<number[]> {
    if (!this._pipe) throw new Error('BuilderEmbedder not loaded');
    const out = await this._pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(out.data);
  }
}
