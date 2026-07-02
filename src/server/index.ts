import { readFileSync } from 'fs';
import { search } from '../core/search.js';
import { buildAnswer } from '../core/renderer.js';
import type { IndexChunk, IndexFile, FallbackReason } from '../core/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SageDeskHandlerConfig {
  /** Filesystem path to the pre-built vector index (e.g. "./public/support-index.json"). */
  indexPath: string;
  /** LLM provider: 'openai', 'deepseek', 'groq', 'gemini', 'anthropic', or any OpenAI-compatible base URL. */
  provider: string;
  /** API key for the LLM provider. Never sent to the browser. */
  apiKey: string;
  /** LLM model name (e.g. 'deepseek-chat', 'gpt-4o-mini', 'llama3-8b-8192'). */
  model: string;
  /** Number of chunks to retrieve for context. Defaults to 5. */
  topK?: number;
  /** Minimum similarity score for a chunk to be included. Defaults to 0.42. */
  minScore?: number;
  /** Override the system prompt sent to the LLM. */
  systemPrompt?: string;
  /** Timeout for LLM API calls in milliseconds. Defaults to 5000 (5 seconds). */
  llmTimeoutMs?: number;
  /**
   * Optional allowlist of request origins (e.g. ['https://example.com']). When
   * set, requests whose Origin (or Referer) doesn't match an entry are rejected
   * with 403. The widget runs on the consumer's own site, so legitimate requests
   * carry a known origin. Non-browser clients can spoof these headers, so treat
   * this as defense-in-depth, not authentication.
   */
  allowedOrigins?: string[];
}

interface QueryRequestBody {
  query?: string;
  queryVector?: number[];
}

// Reject absurdly long queries before they inflate LLM input-token cost.
const MAX_QUERY_LENGTH = 2000;

// Shown when the query vector's length doesn't match the index. This almost
// always means the embedding model differs between build time and runtime.
const DIMENSION_MISMATCH_MESSAGE =
  'Query vector size does not match the knowledge index. The same embedding ' +
  'model must be used at build time and at runtime. Rebuild the index with the ' +
  'model your widget is configured to use (agent.model), or set agent.model to ' +
  'match the model the index was built with.';

// ─── Provider URL map ─────────────────────────────────────────────────────────

const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

// ─── Default system prompt ────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful support assistant. Answer the user\'s question based ONLY on the ' +
  'provided context. If the context does not contain a confident answer, respond with a ' +
  'friendly message saying you don\'t have that information right now. Do not make up ' +
  'information or draw from outside knowledge. Be concise, warm, and helpful.';

// ─── Server-side cache (module-level singleton) ───────────────────────────────

const indexCache = new Map<string, IndexChunk[]>();

function loadIndexFile(indexPath: string): IndexChunk[] {
  if (indexCache.has(indexPath)) return indexCache.get(indexPath)!;

  const raw = readFileSync(indexPath, 'utf-8');
  const data = JSON.parse(raw) as IndexFile | IndexChunk[];
  const chunks: IndexChunk[] = Array.isArray(data) ? data : data.chunks;

  for (const chunk of chunks) {
    chunk.textLower = chunk.text.toLowerCase();
    if (Array.isArray(chunk.vector384)) {
      chunk.vector384 = new Float32Array(chunk.vector384);
    }
  }

  indexCache.set(indexPath, chunks);
  return chunks;
}

/** Returns the vector dimension of the index (e.g. 384), or undefined if empty. */
function getIndexDim(indexPath: string): number | undefined {
  const index = loadIndexFile(indexPath);
  const v = index[0]?.vector384;
  return v ? (v as Float32Array).length : undefined;
}

// ─── Helper: Classify error for client-side logging ───────────────────────────

function classifyError(error: unknown): FallbackReason {
  const msg = String(error).toLowerCase();

  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    return 'auth-error';
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
    return 'quota-exceeded';
  }
  if (msg.includes('timeout') || msg.includes('aborted')) {
    return 'timeout';
  }
  if (msg.includes('malformed') || msg.includes('json')) {
    return 'malformed-response';
  }

  return 'api-error';
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  query: string,
  context: string,
  timeoutMs: number = 5000
): Promise<{ answer: string; error?: FallbackReason }> {
  const url = PROVIDER_URLS[provider] ?? provider;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === 'anthropic') {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = classifyError(`${res.status}`);
        return { answer: '', error };
      }

      const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
      const answer = data.content?.[0]?.text?.trim() ?? '';
      return { answer };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Context:\n${context}\n\nQuestion: ${query}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const error = classifyError(`${res.status}`);
      return { answer: '', error };
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim() ?? '';
    return { answer };
  } catch (err) {
    const error = classifyError(err);
    return { answer: '', error };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ─── Core handler logic ───────────────────────────────────────────────────────

async function handleQuery(
  query: string,
  queryVector: Float32Array,
  config: SageDeskHandlerConfig
): Promise<{ answer: string; isFallback: boolean; fallbackReason?: FallbackReason }> {
  const {
    indexPath,
    provider,
    apiKey,
    model,
    topK = 5,
    minScore = 0.42,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    llmTimeoutMs = 5000,
  } = config;

  const index = loadIndexFile(indexPath);
  const results = search(queryVector, index, topK, minScore);

  if (results.length === 0) {
    return { answer: '', isFallback: true };
  }

  const context = buildAnswer(results);
  const llmResult = await callLLM(
    provider,
    apiKey,
    model,
    systemPrompt,
    query,
    context,
    llmTimeoutMs
  );

  if (!llmResult.answer) {
    return {
      answer: '',
      isFallback: true,
      fallbackReason: llmResult.error,
    };
  }

  return { answer: llmResult.answer, isFallback: false };
}

// ─── Request parsing ──────────────────────────────────────────────────────────

/**
 * Parse and validate {query, queryVector} from a request body. Returns either a
 * usable Float32Array (and the query string) or a string error code suitable
 * for a 400 response.
 *
 * Vectors are required to be (approximately) L2-normalized: the real client
 * always sends unit vectors, and rejecting non-unit vectors defeats crafted
 * payloads that inflate magnitude to force matches past minScore and trigger
 * needless LLM calls. Dimension is checked separately by the handler (it needs
 * the loaded index), so structural validation here never touches the filesystem.
 */
function parseBody(
  body: QueryRequestBody
): { query: string; vector: Float32Array } | { error: string } {
  const query = body.query?.trim();
  if (!query) return { error: 'Missing query' };
  if (query.length > MAX_QUERY_LENGTH) return { error: 'Query too long' };

  const raw = body.queryVector;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Missing queryVector' };
  }

  // Validate every component is finite and accumulate the L2 norm in one pass.
  let sumSq = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { error: 'Invalid queryVector' };
    }
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (norm < 0.99 || norm > 1.01) {
    return { error: 'Invalid queryVector' };
  }

  return { query, vector: new Float32Array(raw) };
}

// ─── Origin allowlist ─────────────────────────────────────────────────────────

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * When `allowedOrigins` is configured, the request's Origin (or, failing that,
 * the origin parsed from its Referer) must exactly match an allowed entry.
 * Returns true when no allowlist is configured, since the feature is opt-in.
 */
function isOriginAllowed(
  allowedOrigins: string[] | undefined,
  origin: string | null | undefined,
  referer: string | null | undefined
): boolean {
  if (!allowedOrigins || allowedOrigins.length === 0) return true;
  const candidate = origin || (referer ? originOf(referer) : undefined);
  if (!candidate) return false;
  return allowedOrigins.includes(candidate);
}

// ─── Next.js App Router handler ───────────────────────────────────────────────

/**
 * Returns a Next.js App Router POST handler.
 *
 * Expects request body: `{ query: string, queryVector: number[] }`. The widget
 * embeds the query in the browser (same WASM model as local mode) and sends
 * both. This keeps the server function tiny and free of native ONNX binaries,
 * so it deploys cleanly on Vercel / Lambda / any serverless runtime.
 *
 * @example
 * // app/api/sagedesk/route.ts
 * import { createSageDeskHandler } from 'sagedesk/server'
 * export const POST = createSageDeskHandler({
 *   indexPath: './public/support-index.json',
 *   provider: 'deepseek',
 *   apiKey: process.env.SAGEDESK_LLM_API_KEY!,
 *   model: 'deepseek-chat',
 * })
 */
export function createSageDeskHandler(config: SageDeskHandlerConfig) {
  return async function POST(request: Request): Promise<Response> {
    try {
      if (!isOriginAllowed(config.allowedOrigins, request.headers.get('origin'), request.headers.get('referer'))) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const body = (await request.json()) as QueryRequestBody;
      const parsed = parseBody(body);

      if ('error' in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      const dim = getIndexDim(config.indexPath);
      if (dim !== undefined && parsed.vector.length !== dim) {
        return Response.json({ error: DIMENSION_MISMATCH_MESSAGE }, { status: 400 });
      }

      const result = await handleQuery(parsed.query, parsed.vector, config);
      return Response.json(result);
    } catch (err) {
      console.error('[sagedesk/server] Handler error:', err);
      return Response.json({ answer: '', isFallback: true }, { status: 500 });
    }
  };
}

// ─── Express / Connect middleware ─────────────────────────────────────────────

type ExpressRequest = {
  body: QueryRequestBody;
  headers?: Record<string, string | string[] | undefined>;
};
type ExpressResponse = {
  status: (code: number) => ExpressResponse;
  json: (data: unknown) => void;
};
type NextFunction = (err?: unknown) => void;

/**
 * Returns an Express (or any Connect-compatible) middleware.
 *
 * Expects `req.body` to be `{ query: string, queryVector: number[] }`. See
 * `createSageDeskHandler` for the rationale.
 *
 * @example
 * // server.ts / index.ts
 * import { createSageDeskMiddleware } from 'sagedesk/server'
 * app.use('/api/sagedesk', express.json(), createSageDeskMiddleware({
 *   indexPath: './public/support-index.json',
 *   provider: 'openai',
 *   apiKey: process.env.SAGEDESK_LLM_API_KEY!,
 *   model: 'gpt-4o-mini',
 * }))
 */
export function createSageDeskMiddleware(config: SageDeskHandlerConfig) {
  return async function sageDeskMiddleware(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction
  ): Promise<void> {
    try {
      const origin = req.headers?.origin;
      const referer = req.headers?.referer;
      if (!isOriginAllowed(
        config.allowedOrigins,
        typeof origin === 'string' ? origin : undefined,
        typeof referer === 'string' ? referer : undefined
      )) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const parsed = parseBody(req.body ?? {});

      if ('error' in parsed) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const dim = getIndexDim(config.indexPath);
      if (dim !== undefined && parsed.vector.length !== dim) {
        res.status(400).json({ error: DIMENSION_MISMATCH_MESSAGE });
        return;
      }

      const result = await handleQuery(parsed.query, parsed.vector, config);
      res.json(result);
    } catch (err) {
      console.error('[sagedesk/server] Middleware error:', err);
      next(err);
    }
  };
}
