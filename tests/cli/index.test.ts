import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import * as chunker from '../../src/cli/chunker';
import { BuilderEmbedder } from '../../src/cli/builder-embedder';
import * as writer from '../../src/cli/writer';

// Mock dependencies
vi.mock('fs', () => {
  const readFileSync = vi.fn();
  const statSync = vi.fn().mockReturnValue({ size: 100 });
  return {
    readFileSync,
    statSync,
    default: {
      readFileSync,
      statSync,
    },
  };
});

vi.mock('../../src/cli/chunker', () => ({
  chunkKnowledge: vi.fn(),
}));

vi.mock('../../src/cli/builder-embedder', () => ({
  BuilderEmbedder: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn().mockResolvedValue([0.1]),
  })),
}));

vi.mock('../../src/cli/writer', () => ({
  writeIndex: vi.fn(),
  formatBytes: vi.fn().mockReturnValue('100 B'),
}));

vi.mock('ora', () => ({
  default: vi.fn().mockReturnValue({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

import { buildAction } from '../../src/cli/index';

describe('CLI index', () => {
  let processExitSpy: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`exit ${code}`);
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should run build command successfully', async () => {
    const mockKnowledge = {
      knowledge: [{ id: '1', answer: 'test' }],
    };
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockKnowledge));
    vi.mocked(chunker.chunkKnowledge).mockReturnValue([{ id: 'c1', sourceId: '1', text: 'test' }] as any);

    await buildAction({
      input: 'knowledge.json',
      output: 'index.json',
      minScore: '0.42',
      verbose: true,
    });

    expect(readFileSync).toHaveBeenCalled();
    expect(chunker.chunkKnowledge).toHaveBeenCalled();
    expect(writer.writeIndex).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Build complete'));
  });

  it('should use the default model when none is specified', async () => {
    const mockKnowledge = { knowledge: [{ id: '1', answer: 'test' }] };
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockKnowledge));
    vi.mocked(chunker.chunkKnowledge).mockReturnValue([{ id: 'c1', sourceId: '1', text: 'test' }] as any);

    await buildAction({ input: 'knowledge.json', output: 'index.json', minScore: '0.42', verbose: false });

    expect(BuilderEmbedder).toHaveBeenCalledWith('all-MiniLM-L6-v2');
  });

  it('should pass the specified model to BuilderEmbedder', async () => {
    const mockKnowledge = { knowledge: [{ id: '1', answer: 'test' }] };
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockKnowledge));
    vi.mocked(chunker.chunkKnowledge).mockReturnValue([{ id: 'c1', sourceId: '1', text: 'test' }] as any);

    await buildAction({
      input: 'knowledge.json',
      output: 'index.json',
      minScore: '0.42',
      model: 'all-mpnet-base-v2',
      verbose: false,
    });

    expect(BuilderEmbedder).toHaveBeenCalledWith('all-mpnet-base-v2');
  });

  it('should exit if knowledge file is invalid', async () => {
    vi.mocked(readFileSync).mockReturnValue('invalid json');

    await expect(buildAction({
      input: 'knowledge.json',
      output: 'index.json',
      minScore: '0.42',
      verbose: false,
    })).rejects.toThrow('exit 1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid knowledge file'),
      expect.anything()
    );
  });
});
