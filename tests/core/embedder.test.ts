import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbedderRuntime } from '../../src/core/embedder';

// We need to mock the dynamic import because Vitest doesn't automatically mock it with vi.mock in setup.ts if it's dynamic
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({ data: new Float32Array([0.1, 0.2]) })),
}));

describe('EmbedderRuntime', () => {
  let runtime: EmbedderRuntime;

  beforeEach(() => {
    runtime = new EmbedderRuntime();
    EmbedderRuntime._reset();
    vi.clearAllMocks();
  });


  it('should initialize correctly', () => {
    expect(runtime.isReady).toBe(false);
    expect(runtime.hasFailed).toBe(false);
  });

  it('should load the pipeline', async () => {
    await runtime.load();
    expect(runtime.isReady).toBe(true);
    expect(runtime.hasFailed).toBe(false);
  });

  it('should embed text', async () => {
    const embedding = await runtime.embed('hello');
    expect(embedding).toBeInstanceOf(Float32Array);
    expect(embedding[0]).toBeCloseTo(0.1);

  });

  it('should handle load failure', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    vi.mocked(pipeline as any).mockRejectedValueOnce(new Error('Load failed'));
    
    const failRuntime = new EmbedderRuntime();
    await expect(failRuntime.load()).rejects.toThrow('Load failed');
    expect(failRuntime.hasFailed).toBe(true);
    
    await expect(failRuntime.load()).rejects.toThrow('EmbedderRuntime previously failed to load');
  });

  it('should handle embedding failure', async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const mockPipeline = vi.fn().mockRejectedValue(new Error('Runtime error'));
    vi.mocked(pipeline as any).mockResolvedValue(mockPipeline as any);

    const failRuntime = new EmbedderRuntime();
    await failRuntime.load();
    await expect(failRuntime.embed('test')).rejects.toThrow('Embedding failed: Error: Runtime error');
  });
});
