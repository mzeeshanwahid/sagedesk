<div align="center">
  <img src="https://raw.githubusercontent.com/mzeeshanwahid/sagedesk/main/assets/cover.jpg" width="1200" alt="sagedesk cover" />
  <h1>sagedesk</h1>
  <p>Local RAG-powered support chat widget. No API key. No backend. No monthly cost. Semantic search runs entirely in the visitor's browser via WebAssembly.</p>
</div>

<br/>

<p align="center"><a href="https://www.npmjs.com/package/sagedesk"><img src="https://img.shields.io/npm/v/sagedesk?color=0ea5e9&label=npm" alt="npm version" /></a> <a href="https://bundlephobia.com/package/sagedesk"><img src="https://img.shields.io/bundlephobia/minzip/sagedesk?color=22c55e&label=gzipped" alt="bundle size" /></a> <a href="./LICENSE"><img src="https://img.shields.io/npm/l/sagedesk?color=a855f7" alt="license" /></a> <a href="https://github.com/mzeeshanwahid/sagedesk/actions"><img src="https://img.shields.io/github/actions/workflow/status/mzeeshanwahid/sagedesk/ci.yml?label=tests" alt="tests" /></a> <a href="./package.json"><img src="https://img.shields.io/badge/dependencies-zero-f97316" alt="zero dependencies" /></a> <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6" alt="TypeScript" /></a></p>

---

## How it works

1.  **Build time** — You run `npx sagedesk build` on your machine. It reads your `knowledge.json`, embeds every entry using a local transformer model (default: `all-MiniLM-L6-v2`), and writes a minified vector index to a static JSON file.
2.  **Runtime** — The widget fetches the index and loads the same model via WebAssembly. Visitor queries are embedded in-browser and matched against the index using optimized semantic search in under 100ms. **No API call is ever made.**

---

## Installation

```bash
npm install sagedesk
```

---

## Step 1 — Write your knowledge file

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

### Knowledge Schema

| Field | Type | Required | Description |
|---|:---:|:---:|:---:|
| `knowledge[].id` | `string` | yes | Unique identifier for the entry. |
| `knowledge[].queries` | `string[]` | no | **Recommended.** Multiple phrasings for better matching. |
| `knowledge[].question` | `string` | no | Legacy single-question field. |
| `knowledge[].answer` | `string` | yes | The answer text shown to visitors. |

---

## Step 2 — Build the index

```bash
npx sagedesk build --input knowledge.json --output public/support-index.json
```

This generates the vector index. Run this whenever your knowledge file changes.

### CLI Options

| Option | Description | Default |
|---|:---:|:---:|
| `-i, --input <path>` | Path to knowledge JSON (Required) | - |
| `-o, --output <path>` | Output path for index JSON | `./public/support-index.json` |
| `--model <name>` | Embedding model to use | `all-MiniLM-L6-v2` |
| `--minScore <number>` | Confidence threshold (0.0 to 1.0) | `0.42` |
| `--verbose` | Print chunk details during build | `false` |

---

## Step 3 — Add the widget

### Vanilla HTML / JS

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

### React

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

### Next.js (App Router)

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

## Configuration (`AgentConfig`)

| Field | Type | Default | Description |
|---|:---:|:---:|:---:|
| `name` | `string` | **Required** | Display name in the chat header. |
| `theme` | `classic`, `light`, `dark` | `classic` | Visual style of the widget. |
| `model` | `string` | `all-MiniLM-L6-v2` | **Must match build-time model.** |
| `accentColor` | `string` | `#534AB7` | Hex color for primary UI elements. |
| `greeting` | `string` | - | Initial message shown to visitors. |
| `fallback` | `string` | - | Message shown when no match is found. |
| `position` | `bottom-right`, `bottom-left` | `bottom-right` | Widget placement. |
| `avatarUrl` | `string` | - | Optional URL for the agent's avatar. |
| `contactUrl` | `string` | - | Link shown in fallback responses. |
| `poweredBy` | `boolean` | `true` | Show "Powered by sagedesk" footer. |
| `suggestedChips` | `string[]` | - | Override auto-generated suggested questions. |

---

## Model Selection

sagedesk defaults to `all-MiniLM-L6-v2` (~22MB), which offers an excellent balance of speed and quality for English.

| Model | Dimensions | Size | Best For |
|---|:---:|:---:|:---:|
| `all-MiniLM-L6-v2` | 384 | ~22 MB | Most English sites. |
| `bge-small-en-v1-5` | 384 | ~25 MB | High-precision English. |
| `paraphrase-multilingual-MiniLM-L12-v2` | 384 | ~45 MB | 50+ languages. |
| `all-mpnet-base-v2` | 768 | ~85 MB | Maximum semantic quality. |

> **Note:** The model used in `npx sagedesk build --model <name>` must match the `agent.model` property in your runtime configuration.

---

## Browser Support

Requires **WebAssembly** support.

- Chrome 90+
- Firefox 89+
- Safari 15+
- Edge 90+

The widget degrades gracefully by hiding itself on unsupported browsers.

---

## License

MIT
