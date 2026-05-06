# Contributing

There are many ways to contribute to `sagedesk`, all of which are valuable. Before you start, please create an issue describing what you want to build or fix — someone may already be working on it, or there may be a reason it isn't implemented yet. The maintainer will point you in the right direction.

## Development setup

1. Fork and clone the repo:

   ```sh
   git clone git@github.com:mzeeshanwahid/sagedesk.git
   cd sagedesk
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Start experimenting — edit `src/` directly, or use `knowledge.example.json` as a scratch input to try things out.

## Commands

**`npm run build`**

Compiles all entry points (`vanilla`, `react`, `next`, `cli`) to `dist` via tsup.

**`npm run dev`**

Compiles in watch mode, useful while iterating on the source.

**`npm test`**

Runs all Vitest tests once.

**`npm run typecheck`**

Type-checks the project without emitting output.

## Tests

Tests live in the `tests/` directory and use [Vitest](https://vitest.dev). When adding a feature or fixing a bug, add or update the relevant test file. Run `npm test` before submitting your PR to make sure nothing is broken.

Test files are organized by entry point and concern:

- `tests/cli/builder-embedder.test.ts` — build-time embedding pipeline
- `tests/cli/chunker.test.ts` — knowledge file parsing and chunking
- `tests/cli/index.test.ts` — CLI command wiring and flags
- `tests/cli/writer.test.ts` — vector index file output
- `tests/core/embedder.test.ts` — in-browser embedding via `@huggingface/transformers`
- `tests/core/search.test.ts` — cosine similarity and nearest-neighbour search
- `tests/core/retriever.test.ts` — index loading and query orchestration
- `tests/core/renderer.test.ts` — answer rendering and markdown handling
- `tests/core/fallback.test.ts` — low-confidence fallback logic
- `tests/vanilla/index.test.ts` — `init()` public API
- `tests/vanilla/widget.test.ts` — widget lifecycle (mount, open, close, destroy)
- `tests/vanilla/ui.test.ts` — DOM structure and theme variants
- `tests/react/SageDeskWidget.test.tsx` — React component rendering and props
- `tests/react/useSageDesk.test.ts` — `useSageDesk` hook behaviour
- `tests/next/SageDeskNext.test.tsx` — Next.js App Router integration

## Project structure

```
src/
  core/
    types.ts          shared TypeScript types
    embedder.ts       in-browser model loading and query embedding
    search.ts         cosine similarity and vector search
    retriever.ts      index fetching and query orchestration
    renderer.ts       answer and markdown rendering
    fallback.ts       low-confidence fallback handling
  vanilla/
    index.ts          init() public API entry point
    widget.ts         widget lifecycle (mount, open, close, destroy)
    ui.ts             DOM construction and theme variants
  react/
    index.ts          React entry point
    SageDeskWidget.tsx React component
    useSageDesk.ts    useSageDesk hook
  next/
    index.ts          Next.js entry point
    SageDeskNext.tsx  App Router server component wrapper
  cli/
    index.ts          CLI entry point and command definitions
    chunker.ts        knowledge.json parsing and chunking
    builder-embedder.ts build-time embedding pipeline
    writer.ts         vector index file output
```

## Pull request guidelines

- Keep changes focused — one concern per PR.
- Update or add tests for every change.
- Run `npm run typecheck && npm test` locally before pushing.
- If your change affects the public API or the `knowledge.json` schema, describe the impact clearly in the PR description.
- The build-time model (set via `--model` in the CLI) and the runtime `agent.model` config **must match** — keep this invariant in mind when touching either path.

## License

By contributing your code to this repository, you agree to license your contribution under the [MIT license](LICENSE).
