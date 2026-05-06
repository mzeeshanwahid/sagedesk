import { describe, it, expect, vi, beforeEach } from 'vitest';
import { search, keywordSearch, loadIndex } from '../../src/core/search';
import type { IndexChunk } from '../../src/core/types';

describe('search', () => {
  // Unit-normalized vectors (as produced by the embedder pipeline with normalize:true).
  // Banana: [0.8, 0.2, 0] / |[0.8, 0.2, 0]| ≈ [0.9701, 0.2425, 0]
  const mockIndex: IndexChunk[] = [
    { id: '1', sourceId: '1', text: 'Apple pie recipe', vector384: [1, 0, 0] },
    { id: '2', sourceId: '2', text: 'Banana bread recipe', vector384: [0.9701, 0.2425, 0] },
    { id: '3', sourceId: '3', text: 'Carrot cake', vector384: [0, 1, 0] },
  ];


  describe('dotProduct (internal via search)', () => {
    it('should calculate correct similarity', () => {
      const query = new Float32Array([1, 0, 0]);
      const results = search(query, mockIndex, 1, 0);
      expect(results[0].chunk.text).toBe('Apple pie recipe');
      expect(results[0].score).toBe(1);
    });

    it('should return 0 for zero vector', () => {
      const query = new Float32Array([0, 0, 0]);
      const results = search(query, mockIndex, 1, 0);
      expect(results[0].score).toBe(0);
    });
  });

  describe('search (vector)', () => {
    it('should sort by score and apply topK and minScore', () => {
      // Unit-normalized query: [0.7, 0.3, 0] / |[0.7, 0.3, 0]| ≈ [0.9191, 0.3939, 0]
      const query = new Float32Array([0.9191, 0.3939, 0]);
      const results = search(query, mockIndex, 2, 0.5);
      
      expect(results).toHaveLength(2);
      expect(results[0].chunk.text).toBe('Banana bread recipe'); // Higher similarity
      expect(results[1].chunk.text).toBe('Apple pie recipe');

    });
  });

  describe('keywordSearch', () => {
    it('should match keywords correctly', () => {
      const results = keywordSearch('apple pie', mockIndex);
      expect(results).toHaveLength(1);
      expect(results[0].chunk.text).toBe('Apple pie recipe');
      expect(results[0].score).toBe(1); // 2 terms matched
    });

    it('should ignore short words and special characters', () => {
      const results = keywordSearch('a very big apple!', mockIndex);
      expect(results).toHaveLength(1);
      expect(results[0].chunk.text).toBe('Apple pie recipe');
      // "a", "very", "big" are likely ignored or partially matched. 
      // "apple" is the main term.
    });

    it('should return empty for no terms', () => {
      expect(keywordSearch('a is', mockIndex)).toEqual([]);
    });

    it('should handle partial matches', () => {
      const results = keywordSearch('apple banana', mockIndex);
      expect(results).toHaveLength(2);
    });
  });

  describe('loadIndex', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should fetch and parse legacy bare-array format', async () => {
      const mockData = [{ text: 'item' }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await loadIndex('http://test.com');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('http://test.com');
    });

    it('should extract chunks from the new IndexFile format', async () => {
      const chunks = [{ id: '1', sourceId: '1', text: 'item', vector384: [0.1] }];
      const indexFile = {
        meta: { model: 'all-MiniLM-L6-v2', builtAt: '2026-01-01T00:00:00.000Z', version: 2 },
        chunks,
      };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => indexFile,
      } as Response);

      const result = await loadIndex('http://test.com');
      expect(result).toEqual(chunks);
    });

    it('should throw error on bad response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(loadIndex('url')).rejects.toThrow('Failed to fetch index (HTTP 404): url');
    });
  });
});
