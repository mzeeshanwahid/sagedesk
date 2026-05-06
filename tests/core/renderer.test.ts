import { describe, it, expect } from 'vitest';
import { buildAnswer, extractChips } from '../../src/core/renderer';
import type { SearchResult } from '../../src/core/types';

describe('renderer', () => {
  describe('buildAnswer', () => {
    it('should return empty string for empty results', () => {
      expect(buildAnswer([])).toBe('');
    });

    it('should join unique-source results with double newline', () => {
      const results: SearchResult[] = [
        { chunk: { id: '1', sourceId: 's1', text: 'Answer 1', vector384: [], vector768: [] }, score: 0.9 },
        { chunk: { id: '2', sourceId: 's2', text: 'Answer 2', vector384: [], vector768: [] }, score: 0.8 },
      ];
      expect(buildAnswer(results)).toBe('Answer 1\n\nAnswer 2');
    });

    it('should deduplicate chunks from the same source entry', () => {
      // Query expansion produces multiple chunks with the same sourceId and text.
      const results: SearchResult[] = [
        { chunk: { id: 'c1-q0', sourceId: 's1', text: 'Answer A', vector384: [], vector768: [] }, score: 0.95 },
        { chunk: { id: 'c1-q1', sourceId: 's1', text: 'Answer A', vector384: [], vector768: [] }, score: 0.91 },
        { chunk: { id: 'c2-q0', sourceId: 's2', text: 'Answer B', vector384: [], vector768: [] }, score: 0.80 },
      ];
      expect(buildAnswer(results)).toBe('Answer A\n\nAnswer B');
    });
  });

  describe('extractChips', () => {
    it('should use override if provided', () => {
      const override = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
      const chips = extractChips([], override);
      expect(chips).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    });

    it('should extract chips from index questions', () => {
      const index = [
        { id: '1', sourceId: '1', text: '...', question: 'How to use?', vector384: [], vector768: [] },
        { id: '2', sourceId: '2', text: '...', question: 'What is it?', vector384: [], vector768: [] },
      ];
      const chips = extractChips(index);
      expect(chips).toEqual(['How to use?', 'What is it?']);
    });

    it('should extract first sentence if question is missing', () => {
      const index = [
        { id: '1', sourceId: '1', text: 'This is the first sentence. This is the second.', vector384: [], vector768: [] },
        { id: '2', sourceId: '2', text: 'Short sentence.', vector384: [], vector768: [] },
      ];
      const chips = extractChips(index);
      expect(chips).toEqual(['This is the first sentence.', 'Short sentence.']);
    });

    it('should limit to 5 unique chips and deduplicate by sourceId', () => {
      const index = [
        { id: '1', sourceId: 's1', text: 'Sentence one.', vector384: [], vector768: [] },
        { id: '2', sourceId: 's1', text: 'Sentence one variation.', vector384: [], vector768: [] }, // Same sourceId
        { id: '3', sourceId: 's2', text: 'Sentence two.', vector384: [], vector768: [] },
        { id: '4', sourceId: 's3', text: 'Sentence three.', vector384: [], vector768: [] },
        { id: '5', sourceId: 's4', text: 'Sentence four.', vector384: [], vector768: [] },
        { id: '6', sourceId: 's5', text: 'Sentence five.', vector384: [], vector768: [] },
        { id: '7', sourceId: 's6', text: 'Sentence six.', vector384: [], vector768: [] },
      ];
      const chips = extractChips(index);
      expect(chips).toHaveLength(5);
      expect(chips).toEqual([
        'Sentence one.',
        'Sentence two.',
        'Sentence three.',
        'Sentence four.',
        'Sentence five.'
      ]);
    });

    it('should handle text with no clear first sentence', () => {
       const index = [{ id: '1', sourceId: '1', text: 'TooShort', vector384: [], vector768: [] }];
       const chips = extractChips(index);
       expect(chips[0]).toBe('TooShort');
    });

  });
});
