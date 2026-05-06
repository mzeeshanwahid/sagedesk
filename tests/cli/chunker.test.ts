import { describe, it, expect } from 'vitest';
import { chunkKnowledge } from '../../src/cli/chunker';
import type { KnowledgeFile } from '../../src/core/types';

describe('chunker', () => {
  // ─── Legacy single-question format ───────────────────────────────────────────

  it('should chunk short knowledge correctly', () => {
    const file: KnowledgeFile = {
            knowledge: [
        { id: '1', question: 'What is it?', answer: 'It is a test.' },
      ],
    };

    const chunks = chunkKnowledge(file);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('It is a test.');
    expect(chunks[0].id).toBe('chunk-1-0');
  });

  it('should split long text into multiple chunks with overlap', () => {
    const longAnswer = Array(150).fill('word').join(' ');
    const file: KnowledgeFile = {
            knowledge: [
        { id: 'long', answer: longAnswer },
      ],
    };

    const chunks = chunkKnowledge(file);

    // WORDS_PER_CHUNK = 100, OVERLAP_WORDS = 15
    // Chunk 0: words 0-100
    // Chunk 1: words 85-150
    expect(chunks).toHaveLength(2);
    expect(chunks[0].id).toBe('chunk-long-0');
    expect(chunks[1].id).toBe('chunk-long-1');

    const words0 = chunks[0].text.split(' ');
    const words1 = chunks[1].text.split(' ');

    expect(words0).toHaveLength(100);
    expect(words1).toHaveLength(65);

    // Verify overlap
    expect(words0.slice(85)).toEqual(words1.slice(0, 15));
  });

  it('should throw if id is missing', () => {
    const file: KnowledgeFile = {
            knowledge: [{ answer: 'test' } as any],
    };

    expect(() => chunkKnowledge(file)).toThrow('Knowledge entry missing required field "id"');
  });

  it('should throw if answer is missing', () => {
    const file: KnowledgeFile = {
            knowledge: [{ id: '1' } as any],
    };

    expect(() => chunkKnowledge(file)).toThrow('Knowledge entry "1" missing required field "answer"');
  });

  it('should only include question in the first chunk', () => {
    const longText = Array(150).fill('word').join(' ');
    const file: KnowledgeFile = {
            knowledge: [
        { id: 'q', question: 'The Question?', answer: longText },
      ],
    };

    const chunks = chunkKnowledge(file);
    expect(chunks[0].question).toBe('The Question?');
    expect(chunks[1].question).toBeUndefined();
  });

  // ─── Query expansion (new format) ────────────────────────────────────────────

  it('should create one chunk per query when queries[] is provided', () => {
    const file: KnowledgeFile = {
            knowledge: [
        {
          id: 'skills',
          answer: 'The developer specializes in React and Node.js.',
          queries: [
            'What is the expertise',
            'What skills does the developer have',
            'What technologies does the developer know',
          ],
        },
      ],
    };

    const chunks = chunkKnowledge(file);
    expect(chunks).toHaveLength(3);

    expect(chunks[0].id).toBe('chunk-skills-q0');
    expect(chunks[1].id).toBe('chunk-skills-q1');
    expect(chunks[2].id).toBe('chunk-skills-q2');

    // Every chunk carries the same answer text
    chunks.forEach((c) => {
      expect(c.text).toBe('The developer specializes in React and Node.js.');
      expect(c.sourceId).toBe('skills');
    });

    // Each chunk stores its own query variation as the question field
    expect(chunks[0].question).toBe('What is the expertise');
    expect(chunks[1].question).toBe('What skills does the developer have');
    expect(chunks[2].question).toBe('What technologies does the developer know');
  });

  it('should produce one chunk when queries[] has a single entry', () => {
    const file: KnowledgeFile = {
            knowledge: [
        {
          id: 'single',
          answer: 'The answer.',
          queries: ['Only one query'],
        },
      ],
    };

    const chunks = chunkKnowledge(file);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('chunk-single-q0');
    expect(chunks[0].question).toBe('Only one query');
  });

  it('should throw when queries is not an array', () => {
    const file: KnowledgeFile = {
            knowledge: [{ id: '1', answer: 'ok', queries: 'bad' as any }],
    };

    expect(() => chunkKnowledge(file)).toThrow('"queries" must be an array');
  });

  it('should produce chunks from multiple entries mixing old and new format', () => {
    const file: KnowledgeFile = {
            knowledge: [
        { id: 'old', question: 'Old question', answer: 'Old answer.' },
        {
          id: 'new',
          answer: 'New answer.',
          queries: ['Query A', 'Query B'],
        },
      ],
    };

    const chunks = chunkKnowledge(file);
    // 1 legacy chunk + 2 query-expansion chunks
    expect(chunks).toHaveLength(3);
    expect(chunks[0].id).toBe('chunk-old-0');
    expect(chunks[1].id).toBe('chunk-new-q0');
    expect(chunks[2].id).toBe('chunk-new-q1');
  });
});
