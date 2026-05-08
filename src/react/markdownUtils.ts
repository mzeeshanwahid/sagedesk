import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  pedantic: false,
});

// Configure DOMPurify for safe HTML
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'hr'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

// Add target="_blank" and rel="noopener noreferrer" to links
const HOOK_ALLOWLIST = ['a'];

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (HOOK_ALLOWLIST.includes(node.tagName.toLowerCase())) {
    if (node.tagName.toLowerCase() === 'a') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

export function parseMarkdown(markdown: string): string {
  const html = marked.parse(markdown) as string;
  const sanitized = DOMPurify.sanitize(html, PURIFY_CONFIG);
  return sanitized;
}
