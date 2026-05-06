import type { SearchResult } from './types';

export function buildAnswer(results: SearchResult[]): string {
  if (results.length === 0) return '';
  // Deduplicate by sourceId: query expansion produces multiple chunks per
  // source entry (same answer, different query phrasings) - show each source once.
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const r of results) {
    if (!seen.has(r.chunk.sourceId)) {
      seen.add(r.chunk.sourceId);
      parts.push(r.chunk.text);
    }
  }
  return parts.join('\n\n');
}

export function extractChips(
  index: { text: string; question?: string; sourceId?: string }[],
  override?: string[]
): string[] {
  if (override && override.length > 0) return override.slice(0, 5);

  const chips: string[] = [];
  const seenText = new Set<string>();
  const seenSource = new Set<string>();

  for (const chunk of index) {
    if (chips.length >= 5) break;

    // Deduplicate by sourceId if available to ensure variety of answers.
    if (chunk.sourceId) {
      if (seenSource.has(chunk.sourceId)) continue;
      seenSource.add(chunk.sourceId);
    }

    const candidate = chunk.question ?? extractFirstSentence(chunk.text);
    if (candidate && !seenText.has(candidate)) {
      seenText.add(candidate);
      chips.push(candidate);
    }
  }

  return chips;
}

function extractFirstSentence(text: string): string {
  const match = text.match(/^[^\n.!?]{10,80}[.!?\n]?/);
  if (!match) return text.slice(0, 60);
  return match[0].trim();
}
