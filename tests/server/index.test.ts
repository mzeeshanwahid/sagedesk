import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module before importing the server module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

vi.mock('../../src/core/search.js', () => ({
  search: vi.fn(),
}));

vi.mock('../../src/core/renderer.js', () => ({
  buildAnswer: vi.fn(),
}));

// A 384-dim vector built once and reused - matches the model's output dimensions.
const FAKE_QUERY_VECTOR = Array.from({ length: 384 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01));

function bodyWithVector(query: string): string {
  return JSON.stringify({ query, queryVector: FAKE_QUERY_VECTOR });
}

describe('server/index.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // createSageDeskHandler (Next.js) Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('createSageDeskHandler', () => {
    it('should return a POST handler function', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      expect(typeof handler).toBe('function');
    });

    it('should return 400 when query is missing', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ queryVector: FAKE_QUERY_VECTOR }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error?: string };
      expect(data.error).toBe('Missing query');
    });

    it('should return 400 when query is empty string', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ query: '   ', queryVector: FAKE_QUERY_VECTOR }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error?: string };
      expect(data.error).toBe('Missing query');
    });

    it('should return 400 when queryVector is missing', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ query: 'hello' }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error?: string };
      expect(data.error).toBe('Missing queryVector');
    });

    it('should return 400 when queryVector contains non-numeric values', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ query: 'hello', queryVector: [0.1, 'oops', 0.2] }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error?: string };
      expect(data.error).toBe('Invalid queryVector');
    });

    it('should handle handler errors and return fallback with 500 status', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );
      const { readFileSync } = await import('fs');

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      // Mock readFileSync to throw an error
      vi.mocked(readFileSync).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: bodyWithVector('test query'),
      });

      const response = await handler(request);
      expect(response.status).toBe(500);
      const data = (await response.json()) as { isFallback?: boolean };
      expect(data.isFallback).toBe(true);
    });

    it('should trim whitespace from query', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ query: '  test query  ', queryVector: FAKE_QUERY_VECTOR }),
      });

      // This should not return a "missing query" error
      // It will fail on file read, but that's expected in test
      const response = await handler(request);
      expect(response.status).not.toBe(400);
    });

    it('should accept custom topK and minScore', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        topK: 10,
        minScore: 0.5,
      });

      expect(typeof handler).toBe('function');
    });

    it('should accept custom systemPrompt', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const customPrompt = 'You are a custom assistant.';
      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        systemPrompt: customPrompt,
      });

      expect(typeof handler).toBe('function');
    });

    it('should support all LLM providers', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const providers = ['openai', 'deepseek', 'groq', 'gemini', 'anthropic'];

      for (const provider of providers) {
        const handler = createSageDeskHandler({
          indexPath: './test-index.json',
          provider,
          apiKey: `test-key-${provider}`,
          model: `test-model-${provider}`,
        });

        expect(typeof handler).toBe('function');
      }
    });

    it('should accept custom OpenAI-compatible base URL', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const customUrl = 'https://custom-api.example.com/v1/chat/completions';
      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: customUrl,
        apiKey: 'test-key',
        model: 'test-model',
      });

      expect(typeof handler).toBe('function');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // createSageDeskMiddleware (Express) Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('createSageDeskMiddleware', () => {
    it('should return a middleware function', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      expect(typeof middleware).toBe('function');
    });

    it('should return 400 when query is missing', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const req = { body: { queryVector: FAKE_QUERY_VECTOR } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing query' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when query is empty string', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const req = { body: { query: '   ', queryVector: FAKE_QUERY_VECTOR } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing query' });
    });

    it('should return 400 when queryVector is missing', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const req = { body: { query: 'hello' } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing queryVector' });
    });

    it('should call next(err) on error', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );
      const { readFileSync } = await import('fs');

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      vi.mocked(readFileSync).mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      const req = { body: { query: 'test', queryVector: FAKE_QUERY_VECTOR } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await middleware(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
    });

    it('should trim whitespace from query', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const req = { body: { query: '  test query  ', queryVector: FAKE_QUERY_VECTOR } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      // Should not return 400 error
      await middleware(req as any, res as any, next);

      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('should accept custom topK and minScore', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        topK: 10,
        minScore: 0.5,
      });

      expect(typeof middleware).toBe('function');
    });

    it('should accept custom systemPrompt', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const customPrompt = 'You are a custom assistant.';
      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        systemPrompt: customPrompt,
      });

      expect(typeof middleware).toBe('function');
    });

    it('should support all LLM providers', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const providers = ['openai', 'deepseek', 'groq', 'gemini', 'anthropic'];

      for (const provider of providers) {
        const middleware = createSageDeskMiddleware({
          indexPath: './test-index.json',
          provider,
          apiKey: `test-key-${provider}`,
          model: `test-model-${provider}`,
        });

        expect(typeof middleware).toBe('function');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Integration Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle all provider configurations', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const config = {
        indexPath: './test-index.json',
        provider: 'openai' as const,
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        topK: 5,
        minScore: 0.42,
        systemPrompt: 'Default prompt',
      };

      const handler = createSageDeskHandler(config);
      expect(typeof handler).toBe('function');
    });

    it('should validate request body parsing', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      // Test with null body
      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ query: null, queryVector: FAKE_QUERY_VECTOR }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
    });

    it('should handle multiple provider types in a single test', async () => {
      const { createSageDeskHandler, createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const baseConfig = {
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      };

      const handler = createSageDeskHandler(baseConfig);
      const middleware = createSageDeskMiddleware(baseConfig);

      expect(typeof handler).toBe('function');
      expect(typeof middleware).toBe('function');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle malformed JSON in request', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await handler(request);
      expect(response.status).toBe(500);
      const data = (await response.json()) as { isFallback?: boolean };
      expect(data.isFallback).toBe(true);
    });

    it('should provide fallback response on query error', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: bodyWithVector('test'),
      });

      const response = await handler(request);
      const data = (await response.json()) as { answer?: string; isFallback?: boolean };
      expect(typeof data.isFallback).toBe('boolean');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Configuration Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Configuration', () => {
    it('should use default values when optional config is not provided', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        // No topK, minScore, or systemPrompt
      });

      expect(typeof handler).toBe('function');
    });

    it('should allow overriding all configuration options', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './custom-index.json',
        provider: 'anthropic',
        apiKey: 'custom-key',
        model: 'claude-3-haiku',
        topK: 3,
        minScore: 0.6,
        systemPrompt: 'Custom system prompt',
      });

      expect(typeof handler).toBe('function');
    });

    it('should preserve query parameter through middleware', async () => {
      const { createSageDeskMiddleware } = await import(
        '../../src/server/index.js'
      );

      const middleware = createSageDeskMiddleware({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const testQuery = 'What is this?';
      const req = { body: { query: testQuery, queryVector: FAKE_QUERY_VECTOR } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      // Middleware should not throw even if file doesn't exist
      await middleware(req as any, res as any, next);

      // Either json was called (if mocked index works) or next was called (if error)
      expect(res.json.mock.calls.length + next.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
