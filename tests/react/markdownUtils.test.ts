import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/react/markdownUtils.js';

describe('markdownUtils', () => {
  it('should parse bold markdown', () => {
    const result = parseMarkdown('**bold text**');
    expect(result).toContain('<strong>bold text</strong>');
  });

  it('should parse headings', () => {
    const result = parseMarkdown('# Heading 1\n## Heading 2');
    expect(result).toContain('<h1>');
    expect(result).toContain('<h2>');
    expect(result).toContain('Heading 1');
    expect(result).toContain('Heading 2');
  });

  it('should parse italic text', () => {
    const result = parseMarkdown('*italic text*');
    expect(result).toContain('<em>italic text</em>');
  });

  it('should parse lists', () => {
    const result = parseMarkdown('- item 1\n- item 2');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
  });

  it('should parse blockquotes', () => {
    const result = parseMarkdown('> quote text');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('quote text');
  });

  it('should sanitize dangerous HTML', () => {
    const result = parseMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('should allow safe links with target="_blank"', () => {
    const result = parseMarkdown('[link](https://example.com)');
    expect(result).toContain('<a');
    expect(result).toContain('href=');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('should handle markdown with multiple elements', () => {
    const markdown = `# About Muhammad Zeeshan

Muhammad Zeeshan is a **Senior Full Stack Engineer** with **7+ years of experience**.

## Key Strengths
- User-focused approach
- Practical AI integration

> His leadership values doing things the right way`;

    const result = parseMarkdown(markdown);
    expect(result).toContain('<h1>');
    expect(result).toContain('<h2>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<blockquote>');
    expect(result).not.toContain('<script>');
  });
});
