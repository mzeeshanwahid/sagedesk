# sagedesk, Context Document

## What is sagedesk

sagedesk is an open-source NPM package that adds a RAG-powered support agent widget to any website. It appears as a floating chat button in the bottom-right (or bottom-left) corner of the page. When clicked, it opens a polished chat panel where visitors can ask questions and receive instant answers.

sagedesk supports two distinct operating modes. In local mode, all semantic search and answer retrieval happens entirely in the browser using WebAssembly with no API key required. In LLM mode, the package ships a server-side handler that the consumer drops into their own backend, enabling LLM-synthesized answers while keeping secrets fully under the consumer's control.

The package is designed for ease of use across vanilla HTML, React, and Next.js projects.

---

## The Problem It Solves

Most chat widget solutions require either a paid LLM API key exposed on the client, a backend server to proxy requests, or a third-party SaaS subscription. This creates cost, complexity, and privacy concerns. sagedesk addresses this in two ways. Local mode eliminates all three concerns entirely. LLM mode gives developers the power of a language model without exposing secrets to the browser or depending on any sagedesk-operated infrastructure.

---

## Operating Modes

### Mode 1. Local Mode (Default)

All embedding, search, and retrieval happens in the visitor's browser via WebAssembly. No API key is required. No external calls are made at runtime. This is the original sagedesk behavior and remains the default.

### Mode 2. LLM Mode

The consumer configures a server-side handler using a sagedesk-provided export. The widget embeds the visitor's query in the browser (same WASM model as local mode), then posts both the query string and the 384-dim query vector to that handler. The handler runs vector search against the prebuilt index and passes the top matching chunks to an LLM for answer synthesis. The LLM API key lives in the consumer's own environment variables and never touches the browser. The server itself never imports `@huggingface/transformers` or any native ONNX runtime, which keeps the function small and serverless-friendly.

sagedesk does not operate any server in this mode. The consumer owns the entire stack.

---

## How It Works, End to End

### Phase 1. Build Time (Developer Machine)

The developer provides a knowledge.json file. Running npx sagedesk build performs the following steps.

Chunking splits knowledge entries into smaller chunks, supporting multiple query phrasings via queries[].

Embedding embeds each chunk using a local transformer model, default all-MiniLM-L6-v2, via Transformers.js.

Indexing writes a minified vector index JSON file, for example support-index.json, to the public directory.

### Phase 2. Runtime in Local Mode (Visitor Browser)

When a visitor opens the site the widget fetches the pre-built vector index and loads the same embedding model via WebAssembly. The visitor query is embedded in-browser, typically under 100ms. A local semantic search runs against the index using optimized dot product calculations. The best matching answer is displayed. If no match exceeds the confidence threshold, a warm fallback message is shown.

### Phase 2. Runtime in LLM Mode (Consumer Server plus Visitor Browser)

When a visitor submits a query the widget embeds it in the browser using the same all-MiniLM-L6-v2 WASM model that local mode uses, then sends a POST request to the consumer's own backend endpoint with both the raw query string and the 384-dim query vector. The sagedesk server handler searches the vector index and retrieves the top K matching chunks. It builds a grounded prompt containing those chunks and calls the configured LLM provider API using the key from the consumer's environment variables. The LLM synthesizes a natural language answer strictly from the provided chunks. The answer is returned to the widget and displayed.

If the retrieved chunks do not contain a confident answer, the LLM is instructed to return a friendly fallback message rather than hallucinate.

Embedding stays on the client so the server function carries no native ONNX runtime and no model weights - the built `sagedesk/server` bundle is under 10 KB and deploys cleanly on Vercel, AWS Lambda, and any other serverless platform with no special configuration.

---

## LLM Mode, Architecture Detail

### Request Flow

```
Consumer's Browser (sagedesk widget)
        |
        |-- Embed query (all-MiniLM-L6-v2, in-browser via WASM)
        |
        |  POST { query, queryVector }
        v
Consumer's Own Server
        |
        |-- 1. Search support-index.json with queryVector, retrieve top-K chunks
        |-- 2. Build grounded prompt with system instructions and chunks
        |-- 3. Call LLM provider API (key from consumer .env)
        |-- 4. Return synthesized answer
        v
Consumer's Browser (answer displayed in widget)
```

### What sagedesk Ships for LLM Mode

The NPM package exports a second entry point, sagedesk/server, containing a provider-agnostic handler factory. The consumer imports this and registers it as a route in their own framework. sagedesk ships no hosted infrastructure.

### Consumer Frontend Configuration

```js
import { SageDesk } from "sagedesk"

<SageDesk
  mode="llm"
  endpoint="/api/sagedesk"
  theme="dark"
/>
```

### Consumer Backend Configuration, Next.js Example

```js
// app/api/sagedesk/route.ts
import { createSageDeskHandler } from "sagedesk/server"

export const POST = createSageDeskHandler({
  indexPath: "./public/support-index.json",
  provider: "deepseek",
  apiKey: process.env.SAGEDESK_LLM_API_KEY,
  model: "deepseek-chat",
})
```

### Consumer Backend Configuration, Express Example

```js
import { createSageDeskMiddleware } from "sagedesk/server"

app.use("/api/sagedesk", createSageDeskMiddleware({
  indexPath: "./public/support-index.json",
  provider: "openai",
  apiKey: process.env.SAGEDESK_LLM_API_KEY,
  model: "gpt-4o-mini",
}))
```

### Environment Variables

```
SAGEDESK_LLM_PROVIDER=deepseek
SAGEDESK_LLM_API_KEY=sk-...
SAGEDESK_LLM_MODEL=deepseek-chat
SAGEDESK_CONFIDENCE_THRESHOLD=0.75
SAGEDESK_TOP_K=5
```

All environment variables are read server-side only. The API key is never sent to the browser under any circumstance.

### LLM Provider Support

The handler is provider-agnostic. Any provider with an OpenAI-compatible chat completions API is supported. Tested and documented providers include DeepSeek, OpenAI, and Groq. The consumer passes provider, apiKey, and model to the handler factory. No LangChain or agent framework is used. The LLM call is a direct fetch to the provider's HTTP endpoint.

### LLM Grounding and Restrictions

The LLM is restricted entirely through the system prompt. It receives only the top-K chunks retrieved from the consumer's vector index. It has no tools, no web search access, and no function calling configured. The system prompt instructs it to answer strictly from the provided context and to return a friendly fallback if the answer is not present. This prevents hallucination and keeps answers grounded in the developer-authored knowledge base.

### Error Handling and Resilience

LLM mode includes built-in resilience against common failure scenarios. All mechanisms are transparent to the user while providing developers with meaningful debugging information.

#### Timeout Protection

Each LLM request is automatically aborted if it exceeds `llmTimeoutMs` (default: 5000 milliseconds). This prevents the widget from hanging indefinitely if the LLM provider is slow or unresponsive. The timeout is configurable per deployment.

#### Graceful Fallback

When an LLM request fails-whether due to timeout, authentication error, quota exhaustion, or malformed response-the handler gracefully falls back to returning the best-matching knowledge chunks without LLM synthesis. Visitors still receive relevant, grounded information from the knowledge base.

#### Error Classification

Errors are classified on the server and communicated to the client:
- **auth-error**: Invalid API key, expired credentials, or authentication failure (HTTP 401/403)
- **quota-exceeded**: Rate limit hit or quota exhaustion (HTTP 429)
- **timeout**: Request timeout or abort signal triggered
- **api-error**: Generic API errors or connection failures
- **malformed-response**: Invalid JSON response from provider

#### Developer Transparency

The browser console logs meaningful, generic warnings for each error class:
- Auth errors: `"[sagedesk] Support service authentication failed. Showing relevant knowledge instead."`
- Quota errors: `"[sagedesk] Support service quota exhausted. Showing relevant knowledge instead."`
- Timeouts: `"[sagedesk] Support service took too long to respond. Showing relevant knowledge instead."`
- API errors: `"[sagedesk] Support service error. Showing relevant knowledge instead."`
- Malformed responses: `"[sagedesk] Support service returned invalid response. Showing relevant knowledge instead."`

These warnings are technical enough for debugging (developers can inspect which type of error occurred) but generic enough that they do not expose sensitive error details to end users if console is accidentally visible.

#### User Experience Guarantee

Visitors always receive a helpful response. The widget never shows an error message to users. Instead:
1. If LLM synthesis succeeds, the natural language answer is displayed.
2. If LLM synthesis fails, the top-K matching knowledge chunks are displayed alongside the configured fallback message.
3. No error state or timeout message is ever shown to visitors.

---

## The Model Strategy

sagedesk uses a single-model strategy to ensure vector space compatibility. The default model is all-MiniLM-L6-v2, approximately 22MB. It is fast, lightweight, and highly effective for semantic similarity. The same model is used at build time (CLI, in Node.js) and at runtime (visitor browser, in WASM), in both local and LLM mode. The server handler does not run the model - it only consumes vectors produced by the browser. Developers can choose other models such as all-mpnet-base-v2 for higher quality at the cost of a larger download, provided the same model is used consistently between the build CLI and the widget's `agent.model` prop.

---

## Scope and Adapters

Core Engine is a pure TypeScript module. The search and retrieval helpers are used by both the browser WASM path and the server handler. The embedder runs in the browser only (and in the build CLI on the developer's machine).

CLI is a Node.js tool for building the vector index via npx sagedesk build.

Server Handler is a new export at sagedesk/server providing createSageDeskHandler for Next.js App Router and createSageDeskMiddleware for Express and compatible frameworks.

Vanilla JS is a web component adapter for script-tag usage, supporting local mode.

React is a robust React component with full state management, supporting both local and LLM modes.

Next.js is a specialized wrapper with ssr: false to support App Router and Turbopack, supporting both local and LLM modes.

---

## Mode Comparison

| | Local Mode | LLM Mode |
|---|---|---|
| API key required | No | Yes, consumer provides |
| Server required | No | Yes, consumer's own server |
| sagedesk infrastructure | None | None |
| Answer quality | Exact retrieval | Natural, synthesized |
| Latency | Under 100ms | 1 to 3 seconds |
| Cost | Zero | Per-query LLM API cost |
| Privacy | Fully local | Query sent to LLM provider |
| Hallucination risk | None | Mitigated via grounded prompt |
| Error resilience | N/A | Built-in: timeouts, fallbacks, automatic recovery |

---

## Themes and Aesthetics

The widget supports three distinct themes.

Classic is the original, familiar chat bubble look.

Light is a clean, airy design with a focus on typography and subtle shadows.

Dark is a modern, high-contrast theme with ambient glows and glassmorphism effects.

---

## What sagedesk is Not

It is not a generative AI chatbot that reasons freely. In LLM mode, the language model is strictly grounded to the developer-authored knowledge base. It does not search the web, call external tools, or use function calling. It does not hallucinate beyond what the provided context contains. sagedesk does not operate any hosted server or relay. The consumer owns their infrastructure, their API key, and their data entirely.

---

## Markdown Rendering in Bot Responses

Bot messages support markdown with full XSS protection via DOMPurify sanitization.

### Implementation

- **Dependencies**: marked (^13.0.0) for parsing, dompurify (^3.0.9) for sanitization
- **Utility**: `src/react/markdownUtils.ts` exports `parseMarkdown()` that parses markdown to HTML and sanitizes it
- **Whitelisted tags**: p, br, strong, em, u, h1-h6, ul, ol, li, blockquote, code, pre, a, hr
- **Security**: All dangerous attributes stripped, scripts prevented, external links safe with `rel="noopener noreferrer"`
- **Integration**: ClassicMessageBubble, LightMessageBubble, and DarkMessageBubble all support markdown rendering
- **Styling**: `.sd-r-markdown` CSS class handles element formatting (headings, lists, code blocks, blockquotes, links)
- **Performance**: <1ms per message, no impact on responsiveness
- **Bundle cost**: ~19KB gzipped (marked ~13KB, dompurify ~6KB)
- **Testing**: 91 tests verify parsing, XSS prevention, and safe rendering
