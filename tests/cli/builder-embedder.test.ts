import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuilderEmbedder } from '../../src/cli/builder-embedder';

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({ data: new Float32Array([0.1]) })),
}));

describe('BuilderEmbedder', () => {
  let embedder: BuilderEmbedder;

  beforeEach(() => {
    embedder = new BuilderEmbedder();
    vi.clearAllMocks();
  });

  it('should throw if embedding before load', async () => {
    await expect(embedder.embed('test')).rejects.toThrow('BuilderEmbedder not loaded');
  });

  it('should load a single pipeline and embed text', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const mockPipe = vi.fn().mockResolvedValue({ data: new Float32Array([0.5]) });
    vi.mocked(pipeline as any).mockResolvedValue(mockPipe as any);

    await embedder.load();

    // Only one model is loaded now (single-model pipeline)
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { dtype: 'q8' }
    );

    const result = await embedder.embed('hello');
    expect(result).toEqual([0.5]);
  });

  it('should use the specified model when provided', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const mockPipe = vi.fn().mockResolvedValue({ data: new Float32Array([0.3]) });
    vi.mocked(pipeline as any).mockResolvedValue(mockPipe as any);

    const mpnetEmbedder = new BuilderEmbedder('all-mpnet-base-v2');
    await mpnetEmbedder.load();

    expect(pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/all-mpnet-base-v2',
      { dtype: 'q8' }
    );
  });
});
