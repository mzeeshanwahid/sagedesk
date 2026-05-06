import { defineConfig } from 'tsup';

export default defineConfig([
  // Vanilla adapter (default export, for plain HTML/script tag usage)
  {
    entry: { index: 'src/vanilla/index.ts' },
    outDir: 'dist/vanilla',
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    external: ['@huggingface/transformers'],
    target: 'es2020',
    sourcemap: true,
  },
  // React adapter
  {
    entry: { index: 'src/react/index.ts' },
    outDir: 'dist/react',
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react', 'react-dom', '@huggingface/transformers'],
    target: 'es2020',
    sourcemap: true,
  },
  // Next.js adapter
  {
    entry: { index: 'src/next/index.ts' },
    outDir: 'dist/next',
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react', 'react-dom', 'next', '@huggingface/transformers'],
    target: 'es2020',
    sourcemap: true,
    // Next.js App Router requires 'use client' at the top of any module that
    // uses React hooks. tsup strips the directive from source files, so we
    // inject it via banner so every built output starts with it.
    clean: true,
    banner: { js: "'use client';" },
  },
  // CLI — output as CJS so Node.js built-in require() calls inside bundled
  // deps (commander, ora, chalk) work regardless of the package "type":"module"
  {
    entry: { index: 'src/cli/index.ts' },
    outDir: 'dist/cli',
    format: ['cjs'],
    dts: false,
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
    external: ['@huggingface/transformers'],
    target: 'node18',
    platform: 'node',
    sourcemap: false,
  },
]);
