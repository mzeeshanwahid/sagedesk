import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIndex, retrieve } from '../../src/core/retriever';
import * as searchModule from '../../src/core/search';
import type { EmbedderRuntime } from '../../src/core/embedder';

vi.mock('../../src/core/search', () => ({
  loadIndex: vi.fn(),
  search: vi.fn(),
  keywordSearch: vi.fn(),
}));

describe('retriever', () => {
  const mockIndex = [{ text: 'item 1', embedding: [0.1] }] as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchIndex', () => {
    it('should call loadIndex and return result', async () => {
      vi.mocked(searchModule.loadIndex).mockResolvedValue(mockIndex);
      const result = await fetchIndex('url');
      expect(result).toBe(mockIndex);
      expect(searchModule.loadIndex).toHaveBeenCalledWith('url');
    });

    it('should throw error if loadIndex fails', async () => {
      vi.mocked(searchModule.loadIndex).mockRejectedValue(new Error('Fetch failed'));
      await expect(fetchIndex('url')).rejects.toThrow('Could not load knowledge index: Error: Fetch failed');
    });
  });

  describe('retrieve', () => {
    let mockEmbedder: any;

    beforeEach(() => {
      mockEmbedder = {
        isReady: true,
        embed: vi.fn().mockResolvedValue(new Float32Array([0.1])),
      };
    });

    it('should use vector search if embedder is ready', async () => {

      const mockResults = [{ chunk: mockIndex[0], score: 0.9 }];
      vi.mocked(searchModule.search).mockReturnValue(mockResults);

      const result = await retrieve('query', mockIndex, mockEmbedder);
      
      expect(result.mode).toBe('vector');
      expect(result.results).toBe(mockResults);
      expect(mockEmbedder.embed).toHaveBeenCalledWith('query');
      expect(searchModule.search).toHaveBeenCalled();
    });

    it('should fallback to keyword search if embedder fails', async () => {
      vi.mocked(mockEmbedder.embed).mockRejectedValue(new Error('Embed fail'));
      const mockResults = [{ chunk: mockIndex[0], score: 1.0 }];
      vi.mocked(searchModule.keywordSearch).mockReturnValue(mockResults);

      const result = await retrieve('query', mockIndex, mockEmbedder);
      
      expect(result.mode).toBe('keyword');
      expect(result.results).toBe(mockResults);
      expect(searchModule.keywordSearch).toHaveBeenCalledWith('query', mockIndex, 3);
    });

    it('should use keyword search if embedder is not ready', async () => {
      const notReadyEmbedder = { isReady: false } as any;
      const mockResults = [{ chunk: mockIndex[0], score: 1.0 }];
      vi.mocked(searchModule.keywordSearch).mockReturnValue(mockResults);

      const result = await retrieve('query', mockIndex, notReadyEmbedder);
      
      expect(result.mode).toBe('keyword');
      expect(searchModule.keywordSearch).toHaveBeenCalled();
    });

    it('should use custom topK and minScore from config', async () => {
      vi.mocked(searchModule.search).mockReturnValue([]);
      const config = { topK: 10, minScore: 0.5 };
      
      await retrieve('query', mockIndex, mockEmbedder, config);
      
      expect(searchModule.search).toHaveBeenCalledWith(expect.anything(), mockIndex, 10, 0.5);
    });
  });
});
