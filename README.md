<div align="center">
  <img src="https://raw.githubusercontent.com/mzeeshanwahid/sagedesk/main/assets/cover.jpg" width="1200" alt="sagedesk cover" />
  <h1 style="margin-top: 16px;">SageDesk</h1>
  <p>RAG-powered support chat widget for any website. Run entirely in the browser with no API key, or connect your own backend for LLM-synthesized answers.</p>
</div>

<br/>

<p align="center"><a href="https://www.npmjs.com/package/sagedesk"><img src="https://img.shields.io/npm/v/sagedesk?color=0ea5e9&label=npm" alt="npm version" /></a> <a href="./LICENSE"><img src="https://img.shields.io/npm/l/sagedesk?color=a855f7" alt="license" /></a> <a href="https://github.com/mzeeshanwahid/sagedesk/actions"><img src="https://img.shields.io/github/actions/workflow/status/mzeeshanwahid/sagedesk/ci.yml?label=tests" alt="tests" /></a> <a href="./package.json"><img src="https://img.shields.io/badge/dependencies-zero-f97316" alt="zero dependencies" /></a> <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6" alt="TypeScript" /></a></p>

---

## Operating Modes

sagedesk ships two modes. Pick the one that fits your needs.

### Local Mode (default)

All embedding and semantic search runs entirely in the visitor's browser via WebAssembly. No API key required. No backend. No per-query cost.

1. **Build time** - Run `npx sagedesk build` on your machine. It reads your `knowledge.json`, embeds every entry using a local transformer model (default: `all-MiniLM-L6-v2`), and writes a minified vector index to a static JSON file.
2. **Runtime** - The widget fetches the index and loads the same model via WebAssembly. Visitor queries are embedded in-browser and matched against the index using optimized semantic search in under 100ms. **No API call is ever made.**

### LLM Mode

The widget posts visitor queries to your own backend. Your backend handles embedding, retrieval, and LLM synthesis. The API key lives in your environment variables and never touches the browser. sagedesk provides ready-made server handlers for Next.js and Express - you own your entire stack.

| | Local Mode | LLM Mode |
|---|---|---|
| API key required | No | Yes, yours |
| Backend required | No | Yes, yours |
| sagedesk infrastructure | None | None |
| Answer style | Exact retrieval | Natural, synthesized |
| Latency | < 100ms | 1–3 seconds |
| Cost | Zero | Per-query LLM API cost |
| Privacy | Fully local | Query sent to your LLM provider |
| Error resilience | N/A | Built-in: timeouts, fallbacks, automatic recovery |

---

## Installation

```bash
npm install sagedesk
```

---

## Local Mode Setup

### Step 1 - Write your knowledge file

Create `knowledge.json` at the root of your project.

```json
{
  "knowledge": [
    {
      "id": "about-1",
      "queries": [
        "Who built this site?",
        "Who is the developer?",
        "Tell me about the author"
      ],
      "answer": "This site was built by Jane Doe, a full-stack developer specialising in React and Node.js."
    },
    {
      "id": "services-1",
      "question": "What services do you offer?",
      "answer": "We offer web development, API design, and technical consulting."
    }
  ]
}
```

#### Knowledge Schema

| Field | Type | Required | Description |
|---|:---:|:---:|---|
| `knowledge[].id` | `string` | yes | Unique identifier for the entry. |
| `knowledge[].queries` | `string[]` | no | **Recommended.** Multiple phrasings for better matching. |
| `knowledge[].question` | `string` | no | Legacy single-question field. |
| `knowledge[].answer` | `string` | yes | The answer text shown to visitors. |

---

### Step 2 - Build the index

```bash
npx sagedesk build --input knowledge.json --output public/support-index.json
```

This generates the vector index. Re-run it whenever your knowledge file changes.

#### CLI Options

| Option | Description | Default |
|---|---|:---:|
| `-i, --input <path>` | Path to knowledge JSON | **Required** |
| `-o, --output <path>` | Output path for index JSON | `./public/support-index.json` |
| `--model <name>` | Embedding model to use | `all-MiniLM-L6-v2` |
| `--minScore <number>` | Confidence threshold (0.0–1.0) | `0.42` |
| `--verbose` | Print chunk details during build | `false` |

---

### Step 3 - Add the widget

#### Vanilla HTML / JS

```html
<script type="module">
  import { init } from 'https://esm.sh/sagedesk';

  init({
    indexUrl: '/support-index.json',
    agent: {
      name: 'Support',
      greeting: 'Hey! How can I help you today?',
      accentColor: '#534AB7',
      theme: 'classic'
    }
  });
</script>
```

#### React

```tsx
import { SageDeskWidget } from 'sagedesk/react';

export default function App() {
  return (
    <SageDeskWidget
      indexUrl="/support-index.json"
      agent={{
        name: 'Support',
        accentColor: '#534AB7',
        theme: 'light'
      }}
    />
  );
}
```

#### Next.js (App Router)

Place in your root layout for site-wide availability.

```tsx
// app/layout.tsx
import { SageDeskNext } from 'sagedesk/next';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SageDeskNext
          indexUrl="/support-index.json"
          agent={{
            name: 'Support',
            theme: 'dark'
          }}
        />
      </body>
    </html>
  );
}
```

---

## LLM Mode Setup

LLM mode requires the same `knowledge.json` and built index from the steps above. You also need an API key from any supported provider (OpenAI, Anthropic, Gemini, DeepSeek, Groq, or any OpenAI-compatible service).

### Step 1 - Add your API key

Add your key to your backend's environment variables. It must never be exposed to the browser.

```
SAGEDESK_LLM_API_KEY=sk-...
```

### Step 2 - Register the server handler

sagedesk exports a server handler from `sagedesk/server`. Drop it into your existing backend - no new server required.

#### Next.js App Router

```ts
// app/api/sagedesk/route.ts
import { createSageDeskHandler } from 'sagedesk/server';

export const POST = createSageDeskHandler({
  indexPath: './public/support-index.json',
  provider: 'deepseek',
  apiKey: process.env.SAGEDESK_LLM_API_KEY!,
  model: 'deepseek-chat',
});
```

#### Express

```ts
import express from 'express';
import { createSageDeskMiddleware } from 'sagedesk/server';

const app = express();
app.use(express.json());

app.use('/api/sagedesk', createSageDeskMiddleware({
  indexPath: './public/support-index.json',
  provider: 'openai',
  apiKey: process.env.SAGEDESK_LLM_API_KEY!,
  model: 'gpt-4o-mini',
}));
```

### Step 3 - Configure the widget

Point the widget at your endpoint with `mode="llm"`. No `indexUrl` needed on the client.

#### React

```tsx
import { SageDeskWidget } from 'sagedesk/react';

export default function App() {
  return (
    <SageDeskWidget
      mode="llm"
      endpoint="/api/sagedesk"
      agent={{
        name: 'Support',
        theme: 'dark'
      }}
    />
  );
}
```

#### Next.js (App Router)

```tsx
// app/layout.tsx
import { SageDeskNext } from 'sagedesk/next';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SageDeskNext
          mode="llm"
          endpoint="/api/sagedesk"
          agent={{
            name: 'Support',
            theme: 'dark'
          }}
        />
      </body>
    </html>
  );
}
```

### Supported LLM Providers

The `provider` field accepts either a **provider name string** or a **full API base URL**. Use a provider name for built-in support, or pass a custom URL if you're using a self-hosted model or a provider not listed below.

#### Built-in Providers

OpenAI, Gemini, DeepSeek, and Groq all use the OpenAI-compatible chat completions format. Anthropic uses its own wire format and is handled natively.

| Provider | `provider` value | Example model |
|---|---|---|
| OpenAI | `'openai'` | `gpt-4o-mini` |
| Anthropic (Claude) | `'anthropic'` | `claude-haiku-4-5-20251001` |
| Google Gemini | `'gemini'` | `gemini-2.0-flash` |
| DeepSeek | `'deepseek'` | `deepseek-chat` |
| Groq | `'groq'` | `llama3-8b-8192` |

#### Custom Providers

If your provider is not listed above, pass the full API base URL as the `provider` value:

```ts
createSageDeskHandler({
  indexPath: './public/support-index.json',
  provider: 'https://api.example.com/v1',  // Custom base URL
  apiKey: process.env.CUSTOM_LLM_API_KEY!,
  model: 'your-model-name',
});
```

### Server Handler Options (`SageDeskHandlerConfig`)

| Option | Type | Required | Description |
|---|:---:|:---:|---|
| `indexPath` | `string` | yes | Filesystem path to the built index JSON. |
| `provider` | `string` | yes | Provider name (e.g., `'openai'`, `'anthropic'`) or full API base URL (e.g., `'https://api.example.com/v1'`). |
| `apiKey` | `string` | yes | LLM API key (server-side only). |
| `model` | `string` | yes | Model name passed to the provider. |
| `embeddingModel` | `string` | no | Must match build-time model. Defaults to `all-MiniLM-L6-v2`. |
| `topK` | `number` | no | Number of chunks retrieved for context. Defaults to `5`. |
| `minScore` | `number` | no | Minimum similarity score for a chunk. Defaults to `0.42`. |
| `systemPrompt` | `string` | no | Override the default system prompt sent to the LLM. |
| `llmTimeoutMs` | `number` | no | Timeout for LLM API calls in milliseconds. Defaults to `5000` (5 seconds). |

---

## Error Handling & Fallbacks (LLM Mode)

sagedesk includes built-in resilience for LLM mode. If the LLM provider fails-whether due to authentication errors, quota exhaustion, timeouts, or malformed responses-the widget gracefully falls back without interrupting the user experience.

### How It Works

1. **Request Timeout** - Each LLM request is automatically aborted if it exceeds `llmTimeoutMs` (default: 5 seconds). This prevents the widget from hanging.

2. **Automatic Fallback** - When an LLM request fails, the server returns the best matching knowledge chunks without synthesis. Visitors still get relevant, grounded information.

3. **Developer Transparency** - The browser console logs meaningful warnings for debugging:
   - `"[sagedesk] Support service authentication failed. Showing relevant knowledge instead."` - Invalid or expired API key
   - `"[sagedesk] Support service quota exhausted. Showing relevant knowledge instead."` - Rate limit hit
   - `"[sagedesk] Support service took too long to respond. Showing relevant knowledge instead."` - Timeout
   - `"[sagedesk] Support service error. Showing relevant knowledge instead."` - Generic API error
   - `"[sagedesk] Support service returned invalid response. Showing relevant knowledge instead."` - Malformed response

4. **User Experience** - Visitors always see a fallback message (configured via `agent.fallback` or `agent.fallbackPool`) alongside relevant knowledge chunks. No errors are exposed to users.

### Configuring Timeout

Adjust the LLM request timeout based on your provider's typical response time:

```ts
// Next.js
export const POST = createSageDeskHandler({
  indexPath: './public/support-index.json',
  provider: 'deepseek',
  apiKey: process.env.SAGEDESK_LLM_API_KEY!,
  model: 'deepseek-chat',
  llmTimeoutMs: 8000,  // 8 seconds
});
```

```ts
// Express
app.use('/api/sagedesk', createSageDeskMiddleware({
  indexPath: './public/support-index.json',
  provider: 'openai',
  apiKey: process.env.SAGEDESK_LLM_API_KEY!,
  model: 'gpt-4o-mini',
  llmTimeoutMs: 10000,  // 10 seconds
}));
```

---

## Widget Configuration (`AgentConfig`)

Applies to both modes.

| Field | Type | Default | Description |
|---|:---:|:---:|---|
| `name` | `string` | **Required** | Display name in the chat header. |
| `theme` | `classic`, `light`, `dark` | `classic` | Visual style of the widget. |
| `model` | `string` | `all-MiniLM-L6-v2` | Embedding model. Must match build-time model. Local mode only. |
| `accentColor` | `string` | `#534AB7` | Hex color for primary UI elements. |
| `greeting` | `string` | - | Initial message shown to visitors. |
| `fallback` | `string` | - | Message shown when no answer is found. |
| `fallbackPool` | `string[]` | - | Array of fallback messages. One is randomly selected when no answer is found. |
| `position` | `bottom-right`, `bottom-left` | `bottom-right` | Widget placement. |
| `avatarUrl` | `string` | - | URL for the agent's avatar image. |
| `contactUrl` | `string` | - | Link appended to fallback responses. |
| `suggestedChips` | `string[]` | - | Override auto-generated suggested questions. |

---

## Search Configuration (`SearchConfig`)

Optional. Applies to both modes. Controls how semantic search matches answers.

| Field | Type | Default | Description |
|---|:---:|:---:|---|
| `minScore` | `number` | `0.42` | Minimum similarity score (0.0–1.0) required for a result to be considered a match. Lower values return more results but may be less relevant. |
| `topK` | `number` | `5` | Maximum number of chunks to retrieve and consider for the answer. |

### Example: Custom Search Settings

```tsx
// Local mode
<SageDeskWidget
  indexUrl="/support-index.json"
  agent={{ name: 'Support' }}
  search={{ minScore: 0.5, topK: 3 }}
/>

// LLM mode
<SageDeskWidget
  mode="llm"
  endpoint="/api/sagedesk"
  agent={{ name: 'Support' }}
  search={{ minScore: 0.6, topK: 5 }}
/>
```

---

## Model Selection

sagedesk defaults to `all-MiniLM-L6-v2` (~22MB), which offers an excellent balance of speed and quality for English. The model used at build time and at runtime must match.

| Model | Dimensions | Size | Best For |
|---|:---:|:---:|---|
| `all-MiniLM-L6-v2` | 384 | ~22 MB | Most English sites. |
| `bge-small-en-v1-5` | 384 | ~25 MB | High-precision English. |
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | ~45 MB | 50+ languages. |
| `all-mpnet-base-v2` | 768 | ~85 MB | Maximum semantic quality. |

> **Note:** The `--model` flag in `npx sagedesk build` must match the `agent.model` prop (local mode) or the `embeddingModel` option in your server handler (LLM mode).

---

## Browser Support

Requires **WebAssembly** support (local mode only - LLM mode has no browser requirements beyond `fetch`).

- Chrome 90+
- Firefox 89+
- Safari 15+
- Edge 90+

The widget degrades gracefully by hiding itself on unsupported browsers.

---

## License

MIT
