import { search, keywordSearch, loadIndex } from './search';
import type { EmbedderRuntime } from './embedder';
import type { IndexChunk, SearchResult, SageDeskConfig } from './types';

export async function fetchIndex(url: string): Promise<IndexChunk[]> {
  try {
    return await loadIndex(url);
  } catch (err) {
    throw new Error(`Could not load knowledge index: ${String(err)}`);
  }
}

export async function retrieve(
  text: string,
  index: IndexChunk[],
  embedder: EmbedderRuntime,
  config?: SageDeskConfig['search']
): Promise<{ results: SearchResult[]; mode: 'vector' | 'keyword' }> {
  const topK = config?.topK ?? 3;
  const minScore = config?.minScore ?? 0.42;

  if (embedder.isReady) {
    try {
      const vector = await embedder.embed(text);
      const results = search(vector, index, topK, minScore);
      return { results, mode: 'vector' };
    } catch {
      // Fall through to keyword search
    }
  }

  const results = keywordSearch(text, index, topK);
  return { results, mode: 'keyword' };
}
