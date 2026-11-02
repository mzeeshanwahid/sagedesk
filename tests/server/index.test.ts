// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module before importing the server module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

// Only vector search is stubbed; context retrieval's keyword pre-filter uses the real keywordSearch.
vi.mock('../../src/core/search.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/search.js')>()),
  search: vi.fn(),
}));

vi.mock('../../src/core/renderer.js', () => ({
  buildAnswer: vi.fn(),
}));

// A 384-dim unit vector built once and reused. The real embedder emits
// L2-normalized vectors (normalize: true), and the server now rejects non-unit
// vectors, so the fixture must be normalized too: |v| = 1.
const UNIT_COMPONENT = 1 / Math.sqrt(384);
const FAKE_QUERY_VECTOR = Array.from({ length: 384 }, (_, i) => (i % 2 === 0 ? UNIT_COMPONENT : -UNIT_COMPONENT));

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

    it('should return 400 when queryVector is not unit-normalized', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      // A crafted, magnitude-inflated vector that would otherwise force matches.
      const inflated = Array.from({ length: 384 }, () => 1);
      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify({ query: 'hello', queryVector: inflated }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error?: string };
      expect(data.error).toBe('Invalid queryVector');
    });

    it('should return 400 when query exceeds the max length', async () => {
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
        body: JSON.stringify({ query: 'a'.repeat(2001), queryVector: FAKE_QUERY_VECTOR }),
      });

      const response = await handler(request);
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error?: string };
      expect(data.error).toBe('Query too long');
    });

    it('should return 403 when Origin is not in the allowlist', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        allowedOrigins: ['https://example.com'],
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        headers: { Origin: 'https://evil.com' },
        body: bodyWithVector('hello'),
      });

      const response = await handler(request);
      expect(response.status).toBe(403);
    });

    it('should not return 403 when Origin is in the allowlist', async () => {
      const { createSageDeskHandler } = await import(
        '../../src/server/index.js'
      );

      const handler = createSageDeskHandler({
        indexPath: './test-index.json',
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        allowedOrigins: ['https://example.com'],
      });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        headers: { Origin: 'https://example.com' },
        body: bodyWithVector('hello'),
      });

      // Passes the origin gate; downstream fails on index read, but never 403/400.
      const response = await handler(request);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(400);
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

  // ───────────────────────────────────────────────────────────────────────────
  // Context retrieval (knowledgePath, no query vector)
  // ───────────────────────────────────────────────────────────────────────────

  describe('Context retrieval', () => {
    const KNOWLEDGE = {
      knowledge: [
        {
          id: 'pricing',
          topic: 'Pricing',
          queries: ['How much does it cost?', 'What is the price?', 'Is it free?', 'Any discounts?'],
          answer: 'Plans start at $10 per month.',
        },
        {
          id: 'refunds',
          question: 'Can I get a refund?',
          answer: 'Refunds are available within 30 days of purchase.',
        },
      ],
    };

    // The knowledge cache is keyed by path and lives for the whole module, so
    // each test gets its own path to start from a clean load.
    let pathCounter = 0;
    const freshPath = () => `./knowledge-${++pathCounter}.json`;

    type FetchCall = [string, { body: string }];

    async function mockKnowledge(data: unknown = KNOWLEDGE) {
      const { readFileSync } = await import('fs');
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(data));
    }

    function mockOpenAIReply(content: string, status = 200) {
      vi.mocked(global.fetch).mockImplementation(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })
      );
    }

    function sentBody(callIndex = 0) {
      const call = vi.mocked(global.fetch).mock.calls[callIndex] as unknown as FetchCall;
      return JSON.parse(call[1].body);
    }

    function post(body: unknown) {
      return new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    async function makeHandler(overrides: Record<string, unknown> = {}) {
      const { createSageDeskHandler } = await import('../../src/server/index.js');
      return createSageDeskHandler({
        knowledgePath: freshPath(),
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        ...overrides,
      });
    }

    it('answers a { query } body with the whole knowledge base in the system prompt', async () => {
      await mockKnowledge();
      mockOpenAIReply('Plans start at $10 per month.');
      const handler = await makeHandler();

      const response = await handler(post({ query: 'How much is it?' }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ answer: 'Plans start at $10 per month.', isFallback: false });

      const body = sentBody();
      const [system, user] = body.messages;
      expect(system.role).toBe('system');
      expect(system.content).toContain('<knowledge_base>');
      expect(system.content).toContain('Plans start at $10 per month.');
      expect(system.content).toContain('Refunds are available within 30 days of purchase.');
      expect(user).toEqual({ role: 'user', content: 'How much is it?' });
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(512);
    });

    it('sends an identical system prompt on every request (prompt-cache friendly)', async () => {
      await mockKnowledge();
      mockOpenAIReply('Answer.');
      const handler = await makeHandler();

      await handler(post({ query: 'first question' }));
      await handler(post({ query: 'second question' }));
      expect(sentBody(0).messages[0].content).toBe(sentBody(1).messages[0].content);
    });

    it('ignores a queryVector, even an invalid one', async () => {
      await mockKnowledge();
      mockOpenAIReply('Answer.');
      const handler = await makeHandler();

      const response = await handler(post({ query: 'hello', queryVector: [1, 'oops', 2] }));
      expect(response.status).toBe(200);
      expect(((await response.json()) as { answer: string }).answer).toBe('Answer.');
    });

    it('turns the [[NO_ANSWER]] sentinel into a fallback', async () => {
      await mockKnowledge();
      mockOpenAIReply('[[NO_ANSWER]]');
      const handler = await makeHandler();

      const response = await handler(post({ query: 'What is the weather?' }));
      expect(await response.json()).toEqual({ answer: '', isFallback: true });
    });

    it('detects the sentinel when the model adds words around it', async () => {
      await mockKnowledge();
      mockOpenAIReply('Sorry, [[NO_ANSWER]].');
      const handler = await makeHandler();

      const response = await handler(post({ query: 'What is the weather?' }));
      expect(await response.json()).toEqual({ answer: '', isFallback: true });
    });

    it('keeps a custom systemPrompt as the base and still appends the answer rules', async () => {
      await mockKnowledge();
      mockOpenAIReply('Answer.');
      const handler = await makeHandler({ systemPrompt: 'You are Zee, a portfolio guide.' });

      await handler(post({ query: 'hello' }));
      const system: string = sentBody().messages[0].content;
      expect(system.startsWith('You are Zee, a portfolio guide.')).toBe(true);
      expect(system).toContain('reply with exactly\n[[NO_ANSWER]]');
      expect(system).toContain('<knowledge_base>');
      expect(system.indexOf('[[NO_ANSWER]]')).toBeLessThan(system.indexOf('<knowledge_base>'));
    });

    it('keeps the fallbackReason when the LLM call fails', async () => {
      await mockKnowledge();
      mockOpenAIReply('', 401);
      const handler = await makeHandler();

      const response = await handler(post({ query: 'hello' }));
      expect(await response.json()).toEqual({ answer: '', isFallback: true, fallbackReason: 'auth-error' });
    });

    it('returns 500 with a fallback and logs the path when the knowledge file is missing', async () => {
      const { readFileSync } = await import('fs');
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const knowledgePath = './missing-knowledge.json';
      const handler = await makeHandler({ knowledgePath });

      const response = await handler(post({ query: 'hello' }));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ answer: '', isFallback: true });
      expect(String(errorSpy.mock.calls[0]?.[1])).toContain(knowledgePath);
      expect(global.fetch).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('returns 500 when the knowledge file has an invalid entry', async () => {
      await mockKnowledge({ knowledge: [{ id: 'no-answer' }] });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler = await makeHandler();

      const response = await handler(post({ query: 'hello' }));
      expect(response.status).toBe(500);
      errorSpy.mockRestore();
    });

    it('rejects a missing query and honours maxQueryLength', async () => {
      await mockKnowledge();
      const handler = await makeHandler({ maxQueryLength: 10 });

      const missing = await handler(post({}));
      expect(missing.status).toBe(400);
      expect(((await missing.json()) as { error: string }).error).toBe('Missing query');

      const tooLong = await handler(post({ query: 'a'.repeat(11) }));
      expect(tooLong.status).toBe(400);
      expect(((await tooLong.json()) as { error: string }).error).toBe('Query too long');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a non-string query with 400', async () => {
      await mockKnowledge();
      const handler = await makeHandler();
      const response = await handler(post({ query: 42 }));
      expect(response.status).toBe(400);
    });

    it('keeps the origin allowlist', async () => {
      await mockKnowledge();
      const handler = await makeHandler({ allowedOrigins: ['https://example.com'] });

      const request = new Request('http://localhost/api/sagedesk', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify({ query: 'hello' }),
      });
      const response = await handler(request);
      expect(response.status).toBe(403);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses context retrieval by default when both knowledgePath and indexPath are set', async () => {
      await mockKnowledge();
      mockOpenAIReply('Answer.');
      const handler = await makeHandler({ indexPath: './test-index.json' });

      const response = await handler(post({ query: 'hello' }));
      expect(response.status).toBe(200);
      expect(sentBody().messages[0].content).toContain('<knowledge_base>');
    });

    it("still requires a queryVector with retrieval: 'vector' even when knowledgePath is set", async () => {
      const handler = await makeHandler({ indexPath: './test-index.json', retrieval: 'vector' });
      const response = await handler(post({ query: 'hello' }));
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: string }).error).toBe('Missing queryVector');
    });

    describe('config validation at creation', () => {
      const base = { provider: 'openai', apiKey: 'k', model: 'm' };

      it('throws when neither knowledgePath nor indexPath is set', async () => {
        const { createSageDeskHandler, createSageDeskMiddleware } = await import('../../src/server/index.js');
        expect(() => createSageDeskHandler(base)).toThrow(/knowledgePath.*indexPath/);
        expect(() => createSageDeskMiddleware(base)).toThrow(/knowledgePath.*indexPath/);
      });

      it("throws for retrieval: 'vector' without indexPath", async () => {
        const { createSageDeskHandler } = await import('../../src/server/index.js');
        expect(() =>
          createSageDeskHandler({ ...base, knowledgePath: './k.json', retrieval: 'vector' })
        ).toThrow(/requires indexPath/);
      });

      it("throws for retrieval: 'context' without knowledgePath", async () => {
        const { createSageDeskHandler } = await import('../../src/server/index.js');
        expect(() =>
          createSageDeskHandler({ ...base, indexPath: './i.json', retrieval: 'context' })
        ).toThrow(/requires knowledgePath/);
      });

      it('throws for an unknown retrieval value', async () => {
        const { createSageDeskHandler } = await import('../../src/server/index.js');
        expect(() =>
          createSageDeskHandler({ ...base, knowledgePath: './k.json', retrieval: 'magic' as never })
        ).toThrow(/Unknown retrieval/);
      });

      it('does not read any file at creation time', async () => {
        const { readFileSync } = await import('fs');
        await makeHandler();
        expect(readFileSync).not.toHaveBeenCalled();
      });
    });

    describe('maxContextTokens', () => {
      it('falls back to a keyword pre-filter and warns once per knowledge file', async () => {
        await mockKnowledge();
        mockOpenAIReply('Refunds within 30 days.');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const handler = await makeHandler({ maxContextTokens: 10 });

        await handler(post({ query: 'Can I get a refund?' }));
        await handler(post({ query: 'refund please' }));

        const system: string = sentBody().messages[0].content;
        expect(system).toContain('Refunds are available within 30 days of purchase.');
        expect(system).not.toContain('Plans start at $10 per month.');
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0][0])).toContain('2 entries');
        warnSpy.mockRestore();
      });

      it('skips the LLM call when the pre-filter finds nothing', async () => {
        await mockKnowledge();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const handler = await makeHandler({ maxContextTokens: 10 });

        const response = await handler(post({ query: 'zebra xylophone' }));
        expect(await response.json()).toEqual({ answer: '', isFallback: true });
        expect(global.fetch).not.toHaveBeenCalled();
        warnSpy.mockRestore();
      });

      it('sends the whole knowledge base under the default limit of 24000', async () => {
        await mockKnowledge();
        mockOpenAIReply('Answer.');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const handler = await makeHandler();

        await handler(post({ query: 'zebra xylophone' }));
        expect(sentBody().messages[0].content).toContain('Plans start at $10 per month.');
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
      });
    });

    describe('cacheTtlMs', () => {
      it('answers a repeated question from the cache, ignoring case and spacing', async () => {
        await mockKnowledge();
        mockOpenAIReply('Plans start at $10 per month.');
        const handler = await makeHandler({ cacheTtlMs: 60_000 });

        await handler(post({ query: 'How much is it?' }));
        const second = await handler(post({ query: '  how   MUCH is it?' }));
        expect(await second.json()).toEqual({ answer: 'Plans start at $10 per month.', isFallback: false });
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('does not cache fallbacks', async () => {
        await mockKnowledge();
        mockOpenAIReply('[[NO_ANSWER]]');
        const handler = await makeHandler({ cacheTtlMs: 60_000 });

        await handler(post({ query: 'weather?' }));
        await handler(post({ query: 'weather?' }));
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('does not cache errors', async () => {
        await mockKnowledge();
        mockOpenAIReply('', 500);
        const handler = await makeHandler({ cacheTtlMs: 60_000 });

        await handler(post({ query: 'hello' }));
        await handler(post({ query: 'hello' }));
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('expires entries after the TTL', async () => {
        await mockKnowledge();
        mockOpenAIReply('Answer.');
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
        const handler = await makeHandler({ cacheTtlMs: 5_000 });

        await handler(post({ query: 'hello' }));
        nowSpy.mockReturnValue(5_999);
        await handler(post({ query: 'hello' }));
        expect(global.fetch).toHaveBeenCalledTimes(1);

        nowSpy.mockReturnValue(6_000);
        await handler(post({ query: 'hello' }));
        expect(global.fetch).toHaveBeenCalledTimes(2);
        nowSpy.mockRestore();
      });

      it('is off by default', async () => {
        await mockKnowledge();
        mockOpenAIReply('Answer.');
        const handler = await makeHandler();

        await handler(post({ query: 'hello' }));
        await handler(post({ query: 'hello' }));
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('promptCache', () => {
      function mockAnthropicReply(text: string) {
        vi.mocked(global.fetch).mockImplementation(async () =>
          new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 })
        );
      }

      it('sends the Anthropic system prompt as a plain string by default', async () => {
        await mockKnowledge();
        mockAnthropicReply('Answer.');
        const handler = await makeHandler({ provider: 'anthropic' });

        const response = await handler(post({ query: 'hello' }));
        expect(((await response.json()) as { answer: string }).answer).toBe('Answer.');
        const body = sentBody();
        expect(typeof body.system).toBe('string');
        expect(body.system).toContain('<knowledge_base>');
        expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
      });

      it('marks the Anthropic system prompt with cache_control when promptCache is true', async () => {
        await mockKnowledge();
        mockAnthropicReply('Answer.');
        const handler = await makeHandler({ provider: 'anthropic', promptCache: true });

        await handler(post({ query: 'hello' }));
        const { system } = sentBody();
        expect(system).toHaveLength(1);
        expect(system[0].type).toBe('text');
        expect(system[0].text).toContain('<knowledge_base>');
        expect(system[0].cache_control).toEqual({ type: 'ephemeral' });
      });

      it('marks the OpenAI-compatible system message with cache_control when promptCache is true', async () => {
        await mockKnowledge();
        mockOpenAIReply('Answer.');
        const handler = await makeHandler({
          provider: 'https://openrouter.ai/api/v1/chat/completions',
          promptCache: true,
        });

        await handler(post({ query: 'hello' }));
        const [system] = sentBody().messages;
        expect(system.content[0].cache_control).toEqual({ type: 'ephemeral' });
        expect(system.content[0].text).toContain('<knowledge_base>');
      });
    });

    it("keeps the 2.x vector flow: Context wrapper and a replaced system prompt", async () => {
      const { readFileSync } = await import('fs');
      const { search } = await import('../../src/core/search.js');
      const { buildAnswer } = await import('../../src/core/renderer.js');
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ meta: {}, chunks: [{ id: 'c', sourceId: 's', text: 'Chunk text', vector384: FAKE_QUERY_VECTOR }] })
      );
      vi.mocked(search).mockReturnValue([{ chunk: { id: 'c', sourceId: 's', text: 'Chunk text', vector384: [] }, score: 0.9 }]);
      vi.mocked(buildAnswer).mockReturnValue('Chunk text');
      mockOpenAIReply('Vector answer.');

      const { createSageDeskHandler } = await import('../../src/server/index.js');
      const handler = createSageDeskHandler({
        indexPath: `./vector-index-${++pathCounter}.json`,
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        systemPrompt: 'Custom vector prompt.',
      });

      const response = await handler(post({ query: 'hello', queryVector: FAKE_QUERY_VECTOR }));
      expect(await response.json()).toEqual({ answer: 'Vector answer.', isFallback: false });
      const [system, user] = sentBody().messages;
      expect(system.content).toBe('Custom vector prompt.');
      expect(user.content).toBe('Context:\nChunk text\n\nQuestion: hello');
    });

    it('works through the Express middleware with a { query } body', async () => {
      await mockKnowledge();
      mockOpenAIReply('Answer.');
      const { createSageDeskMiddleware } = await import('../../src/server/index.js');
      const middleware = createSageDeskMiddleware({
        knowledgePath: freshPath(),
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      });

      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      await middleware({ body: { query: 'hello' } } as any, res as any, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ answer: 'Answer.', isFallback: false });
    });
  });
});
