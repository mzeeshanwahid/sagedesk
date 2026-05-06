import type { KnowledgeEntry, KnowledgeFile } from '../core/types';

export interface RawChunk {
  id: string;
  sourceId: string;
  text: string;      // Answer text shown to visitors
  question?: string; // Query text used as the embedding input
}

const WORDS_PER_CHUNK = 100;
const OVERLAP_WORDS = 15;

function splitText(text: string, sourceId: string, baseId: string, question?: string): RawChunk[] {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= WORDS_PER_CHUNK) {
    return [{ id: `${baseId}-0`, sourceId, text: text.trim(), question }];
  }

  const chunks: RawChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + WORDS_PER_CHUNK, words.length);
    const chunkText = words.slice(start, end).join(' ');

    chunks.push({
      id: `${baseId}-${chunkIndex}`,
      sourceId,
      text: chunkText,
      question: chunkIndex === 0 ? question : undefined,
    });

    chunkIndex++;
    if (end >= words.length) break;
    start = end - OVERLAP_WORDS;
  }

  return chunks;
}

export function chunkKnowledge(knowledgeFile: KnowledgeFile): RawChunk[] {
  const chunks: RawChunk[] = [];

  for (const entry of knowledgeFile.knowledge) {
    validateEntry(entry);

    if (entry.queries && entry.queries.length > 0) {
      // Query expansion: one chunk per query variation, all carrying the same answer text.
      // Each chunk gets its own vector derived from the query string alone,
      // so user questions that resemble any variation will match.
      for (let qi = 0; qi < entry.queries.length; qi++) {
        chunks.push({
          id: `chunk-${entry.id}-q${qi}`,
          sourceId: entry.id,
          text: entry.answer,
          question: entry.queries[qi],
        });
      }
    } else {
      // Legacy format: split the answer into overlapping windows and attach the
      // single question (if any) to the first chunk only.
      const entryChunks = splitText(
        entry.answer,
        entry.id,
        `chunk-${entry.id}`,
        entry.question
      );
      chunks.push(...entryChunks);
    }
  }

  return chunks;
}

function validateEntry(entry: KnowledgeEntry): void {
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
