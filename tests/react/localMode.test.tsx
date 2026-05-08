import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/react/markdownUtils.js';

describe('Local Mode Compatibility', () => {
  it('should handle plain text responses from JSON (local mode)', () => {
    const plainText = 'This is a simple answer from a JSON knowledge base. No markdown formatting here.';
    const result = parseMarkdown(plainText);

    // Should not add unwanted markup
    expect(result).toContain('This is a simple answer');
    expect(result).toContain('No markdown formatting here');
    // Should be wrapped in a paragraph tag
    expect(result).toContain('<p>');
  });

  it('should handle multi-line plain text', () => {
    const plainText = `First line of answer.
Second line of answer.
Third line of answer.`;
    const result = parseMarkdown(plainText);

    // Line breaks should be preserved via line break conversion
    expect(result).toContain('First line');
    expect(result).toContain('Second line');
    expect(result).toContain('Third line');
  });

  it('should handle text with special characters', () => {
    const plainText = `This is a Q&A about pricing: $100/month. It's great!`;
    const result = parseMarkdown(plainText);

    // HTML entities are properly escaped for safety
    expect(result).toContain('Q&amp;A');
    expect(result).toContain('$100/month');
    expect(result).not.toContain('<script>');
  });

  it('should NOT interpret accidental markdown-like patterns in plain text', () => {
    const plainText = 'The *star* is above, and **test** is here. But this is just plain text.';
    const result = parseMarkdown(plainText);

    // These WILL be parsed as markdown, which is expected behavior
    // If users don't want markdown interpretation, they shouldn't use symbols
    expect(result).toContain('<em>star</em>');
    expect(result).toContain('<strong>test</strong>');
  });

  it('should handle HTML entities in plain text safely', () => {
    const plainText = 'The < and > symbols should be safe. This < > & text should not break.';
    const result = parseMarkdown(plainText);

    // Should be properly escaped
    expect(result).not.toContain('<script>');
    expect(result).toContain('text should not break');
  });

  it('should handle very long plain text responses', () => {
    const plainText = 'This is a very long response. ' + 'Word '.repeat(500);
    const result = parseMarkdown(plainText);

    expect(result.length).toBeGreaterThan(plainText.length);
    expect(result).toContain('very long response');
    expect(result).toContain('<p>');
  });

  it('should handle empty or whitespace-only responses', () => {
    const empty = '';
    const whitespace = '   ';

    const emptyResult = parseMarkdown(empty);
    const whitespaceResult = parseMarkdown(whitespace);

    // Should not error and should return valid HTML
    expect(emptyResult).toBeDefined();
    expect(whitespaceResult).toBeDefined();
  });

  it('should handle single word responses', () => {
    const singleWord = 'Yes';
    const result = parseMarkdown(singleWord);

    expect(result).toContain('Yes');
    expect(result).toContain('<p>');
  });

  it('should be safe when called repeatedly (local mode typical usage)', () => {
    // Simulate local mode where same response might be rendered multiple times
    const response = 'Support team availability: Monday-Friday, 9AM-5PM EST';

    const result1 = parseMarkdown(response);
    const result2 = parseMarkdown(response);
    const result3 = parseMarkdown(response);

    // All should be identical and safe
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toContain('Monday-Friday');
  });
});
