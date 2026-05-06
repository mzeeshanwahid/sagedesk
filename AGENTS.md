# sagedesk, Context Document

## What is sagedesk

sagedesk is an open-source NPM package that adds a local RAG-powered support agent widget to any website. It appears as a floating chat button in the bottom-right (or bottom-left) corner of the page. When clicked, it opens a polished chat panel where visitors can ask questions and receive instant answers retrieved from a developer-configured JSON knowledge file.

The defining constraint of sagedesk is that it runs entirely without an LLM API key in production. All semantic search and answer retrieval happens locally in the browser using WebAssembly. There is no backend server, no runtime API calls, and no monthly cost for the website owner.

The package is designed for ease of use across vanilla HTML, React, and Next.js projects.

---

## The Problem It Solves

Most chat widget solutions require either a paid LLM API key exposed on the client, a backend server to proxy requests, or a third-party SaaS subscription. This creates cost, complexity, and privacy concerns. sagedesk eliminates all three by doing the heavy semantic work at build time and shipping only a lightweight browser-side retrieval engine.

---

## How It Works, End to End

### Phase 1: Build Time (Developer Machine)

The developer provides a `knowledge.json` file. Running `npx sagedesk build` performs the following:
1. **Chunking:** Splits knowledge entries into smaller chunks (supporting multiple query phrasings via `queries[]`).
2. **Embedding:** Embeds each chunk using a local transformer model (default: `all-MiniLM-L6-v2`) via Transformers.js.
3. **Indexing:** Writes a minified vector index JSON file (e.g., `support-index.json`) to the public directory.

### Phase 2: Runtime (Visitor Browser)

When a visitor opens the site:
1. **Loading:** The widget fetches the pre-built vector index and loads the same embedding model via WebAssembly.
2. **Search:** The visitor's query is embedded in-browser (typically <100ms).
3. **Retrieval:** A local semantic search runs against the index using optimized dot product calculations.
4. **Answer:** The best matching answer is displayed. If no match exceeds the confidence threshold, a warm fallback message is shown.

---

## The Model Strategy

sagedesk uses a **single-model strategy** to ensure vector space compatibility.
- **Default Model:** `all-MiniLM-L6-v2` (~22MB). It is fast, lightweight, and highly effective for semantic similarity.
- **Consistency:** The same model used at build time must be used at runtime.
- **Flexibility:** Developers can choose other models (like `all-mpnet-base-v2`) for higher quality at the cost of a larger download.

---

## Scope & Adapters

- **Core Engine:** A pure TypeScript module handling search, retrieval, and embedding.
- **CLI:** Node.js tool for building the vector index.
- **Vanilla JS:** Web component adapter for script-tag usage.
- **React:** A robust React component with full state management.
- **Next.js:** Specialized wrapper with `ssr: false` to support App Router and Turbopack.

---

## Themes & Aesthetics

The widget supports three distinct themes:
1. **Classic:** The original, familiar chat bubble look.
2. **Light:** A clean, airy design with a focus on typography and subtle shadows.
3. **Dark:** A modern, high-contrast theme with ambient glows and glassmorphism effects.

---

## What sagedesk is Not

It is not a generative AI chatbot. It retrieves and presents what the developer wrote. It does not hallucinate, it does not call external LLM APIs at runtime, and it does not require a database server.
