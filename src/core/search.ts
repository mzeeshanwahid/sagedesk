import type { IndexChunk, SearchResult } from './types';

// Both the query vector (embedder.ts, normalize:true) and stored vectors
// (builder-embedder.ts, normalize:true) are guaranteed unit-length, so
// cosine similarity reduces to a plain dot product - no norms needed.
function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: query(${a.length}) vs index(${b.length})`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function search(
  queryVector: Float32Array,
  index: IndexChunk[],
  topK = 3,
  minScore = 0.42
): SearchResult[] {
  // Use a simple selection sort approach for small topK, 
  // or a full sort if index is small. For very large indexes, 
  // a proper Heap would be better, but O(N * topK) is already better than O(N log N).
  const results: SearchResult[] = [];

  for (const chunk of index) {
    const score = dotProduct(queryVector, chunk.vector384 as Float32Array);
    if (score < minScore) continue;

    if (results.length < topK) {
      results.push({ chunk, score });
      results.sort((a, b) => b.score - a.score);
    } else if (score > results[topK - 1].score) {
      results[topK - 1] = { chunk, score };
      results.sort((a, b) => b.score - a.score);
    }
  }

  return results;
}

export function keywordSearch(
  query: string,
  index: IndexChunk[],
  topK = 3
): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[^a-z0-9]/g, ''));

  if (terms.length === 0) return [];

  const results: SearchResult[] = [];

  for (const chunk of index) {
    const chunkLower = chunk.textLower || chunk.text.toLowerCase();
    const matchCount = terms.filter((t) => chunkLower.includes(t)).length;
    const score = matchCount / terms.length;

    if (score <= 0) continue;

    if (results.length < topK) {
      results.push({ chunk, score });
      results.sort((a, b) => b.score - a.score);
    } else if (score > results[topK - 1].score) {
      results[topK - 1] = { chunk, score };
      results.sort((a, b) => b.score - a.score);
    }
  }

  return results;
}

export async function loadIndex(url: string): Promise<IndexChunk[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch index (HTTP ${res.status}): ${url}`);
  }
  const data = await res.json();
  // Support both the new { meta, chunks } format and the legacy bare-array format.
  const chunks: IndexChunk[] = Array.isArray(data)
    ? data
    : (data as { chunks: IndexChunk[] }).chunks;

  // Materialize lowercase versions and convert vectors to Float32Array once at load time.
  for (const chunk of chunks) {
    chunk.textLower = chunk.text.toLowerCase();
    if (Array.isArray(chunk.vector384)) {
      chunk.vector384 = new Float32Array(chunk.vector384);
    }
    if (Array.isArray(chunk.vector768)) {
      chunk.vector768 = new Float32Array(chunk.vector768);
    }
  }

  return chunks;
}
