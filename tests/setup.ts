import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Transformers.js
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
  AutoTokenizer: {
    from_pretrained: vi.fn(),
  },
  AutoModel: {
    from_pretrained: vi.fn(),
  },
}));

// Mock browser APIs that might be missing in jsdom. Server tests run in the
// node environment, where there is no window.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
