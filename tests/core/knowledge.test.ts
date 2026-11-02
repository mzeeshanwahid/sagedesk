import { describe, it, expect } from 'vitest';
import {
  validateEntry,
  parseKnowledgeFile,
  formatKnowledgeEntry,
  formatKnowledge,
  estimateTokens,
  knowledgeToChunks,
} from '../../src/core/knowledge';
import type { KnowledgeEntry } from '../../src/core/types';

const pricing: KnowledgeEntry = {
  id: 'pricing',
  topic: 'Pricing',
  queries: ['How much does it cost?', 'What is the price?', 'Is it free?', 'Any discounts?'],
  answer: '  Plans start at $10 per month.  ',
};

const refunds: KnowledgeEntry = {
  id: 'refunds',
  question: 'Can I get a refund?',
  answer: 'Refunds are available within 30 days.',
};

const bare: KnowledgeEntry = { id: 'hours', answer: 'We are open 9 to 5.' };

describe('validateEntry', () => {
  it('accepts a valid entry', () => {
    expect(() => validateEntry(pricing)).not.toThrow();
  });

  it('rejects a missing id', () => {
    expect(() => validateEntry({ answer: 'x' } as KnowledgeEntry)).toThrow(/"id"/);
  });

  it('rejects a missing answer', () => {
    expect(() => validateEntry({ id: 'a' } as KnowledgeEntry)).toThrow(/"a" missing required field "answer"/);
  });

  it('rejects queries that are not an array', () => {
    expect(() => validateEntry({ id: 'a', answer: 'b', queries: 'q' as never })).toThrow(/must be an array/);
  });
});

describe('parseKnowledgeFile', () => {
  it('returns the entries in file order', () => {
    const entries = parseKnowledgeFile(JSON.stringify({ knowledge: [refunds, pricing] }));
    expect(entries.map((e) => e.id)).toEqual(['refunds', 'pricing']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseKnowledgeFile('not json')).toThrow();
  });

  it('throws when the knowledge array is missing', () => {
    expect(() => parseKnowledgeFile(JSON.stringify({ entries: [] }))).toThrow(/"knowledge" array/);
  });

  it('throws when an entry is invalid', () => {
    expect(() => parseKnowledgeFile(JSON.stringify({ knowledge: [{ id: 'x' }] }))).toThrow(/"answer"/);
  });
});

describe('formatKnowledgeEntry', () => {
  it('uses the topic as the heading and caps query variants at 3', () => {
    expect(formatKnowledgeEntry(pricing)).toBe(
      '## Pricing\n' +
      'Asked as: How much does it cost? | What is the price? | Is it free?\n' +
      'Plans start at $10 per month.'
    );
  });

  it('falls back to the id and the single question', () => {
    expect(formatKnowledgeEntry(refunds)).toBe(
      '## refunds\nAsked as: Can I get a refund?\nRefunds are available within 30 days.'
    );
  });

  it('omits the "Asked as" line when there are no questions', () => {
    expect(formatKnowledgeEntry(bare)).toBe('## hours\nWe are open 9 to 5.');
  });

  it('is deterministic', () => {
    expect(formatKnowledgeEntry(pricing)).toBe(formatKnowledgeEntry({ ...pricing }));
  });
});

describe('formatKnowledge', () => {
  it('keeps the given order, separated by blank lines', () => {
    const text = formatKnowledge([refunds, bare]);
    expect(text).toBe(`${formatKnowledgeEntry(refunds)}\n\n${formatKnowledgeEntry(bare)}`);
  });

  it('produces identical output on repeated calls', () => {
    expect(formatKnowledge([pricing, refunds, bare])).toBe(formatKnowledge([pricing, refunds, bare]));
  });
});

describe('estimateTokens', () => {
  it('estimates chars / 4, rounded up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('knowledgeToChunks', () => {
  it('builds one keyword-searchable chunk per entry with every question variant', () => {
    const chunks = knowledgeToChunks([pricing, refunds, bare]);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].sourceId).toBe('pricing');
    // All four variants, not just the three shown to the LLM.
    expect(chunks[0].textLower).toContain('any discounts?');
    expect(chunks[1].textLower).toContain('can i get a refund?');
    expect(chunks[2].text).toBe('We are open 9 to 5.');
  });
});
