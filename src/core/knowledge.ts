import type { IndexChunk, KnowledgeEntry, KnowledgeFile } from './types';

// Pure helpers for working with knowledge.json directly (no vectors). Shared by
// the CLI (entry validation) and the server's context retrieval. Keep this file
// free of Node and browser specific imports so either side can bundle it.

// Most query variants listed under "Asked as:" per entry. More adds tokens to
// every request without helping the model much.
const MAX_QUERY_VARIANTS = 3;

export function validateEntry(entry: KnowledgeEntry): void {
  if (!entry.id || typeof entry.id !== 'string') {
    throw new Error(`Knowledge entry missing required field "id": ${JSON.stringify(entry)}`);
  }
  if (!entry.answer || typeof entry.answer !== 'string') {
    throw new Error(`Knowledge entry "${entry.id}" missing required field "answer"`);
  }
  if (entry.queries !== undefined && !Array.isArray(entry.queries)) {
    throw new Error(`Knowledge entry "${entry.id}": "queries" must be an array of strings`);
  }
}

/** Parses and validates the contents of a knowledge.json file. Throws on invalid input. */
export function parseKnowledgeFile(raw: string): KnowledgeEntry[] {
  const data = JSON.parse(raw) as KnowledgeFile;
  if (!data || !Array.isArray(data.knowledge)) {
    throw new Error('Invalid knowledge file: missing "knowledge" array');
  }
  for (const entry of data.knowledge) validateEntry(entry);
  return data.knowledge;
}

function askedAs(entry: KnowledgeEntry): string[] {
  if (entry.queries && entry.queries.length > 0) {
    return entry.queries.slice(0, MAX_QUERY_VARIANTS);
  }
  return entry.question ? [entry.question] : [];
}

/**
 * Formats one entry for the LLM prompt. Output is deterministic: the same entry
 * always produces the same text, which keeps the prompt prefix stable across
 * requests so provider-side prompt caching can work.
 */
export function formatKnowledgeEntry(entry: KnowledgeEntry): string {
  const lines = [`## ${entry.topic || entry.id}`];
  const variants = askedAs(entry);
  if (variants.length > 0) lines.push(`Asked as: ${variants.join(' | ')}`);
  lines.push(entry.answer.trim());
  return lines.join('\n');
}

/** Formats entries in the order given, separated by a blank line. */
export function formatKnowledge(entries: KnowledgeEntry[]): string {
  return entries.map(formatKnowledgeEntry).join('\n\n');
}

/** Rough token estimate (chars / 4). Good enough for a size guard, not for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * One pseudo-chunk per entry (all question variants plus the answer) so the
 * existing keywordSearch can rank entries when the knowledge base is too large
 * to send whole. These chunks carry no vectors.
 */
export function knowledgeToChunks(entries: KnowledgeEntry[]): IndexChunk[] {
  return entries.map((entry) => {
    const questions = entry.queries ?? (entry.question ? [entry.question] : []);
    const text = [...questions, entry.answer].join('\n');
    return {
      id: `entry-${entry.id}`,
      sourceId: entry.id,
      text,
      textLower: text.toLowerCase(),
      vector384: [],
    };
  });
}
