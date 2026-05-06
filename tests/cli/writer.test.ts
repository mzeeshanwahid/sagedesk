import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeIndex, formatBytes } from '../../src/cli/writer';
import { writeFileSync, mkdirSync } from 'fs';
import type { IndexFile } from '../../src/core/types';

vi.mock('fs', () => {
  const writeFileSync = vi.fn();
  const mkdirSync = vi.fn();
  return {
    writeFileSync,
    mkdirSync,
    default: {
      writeFileSync,
      mkdirSync,
    },
  };
});

describe('writer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeIndex', () => {
    it('should create directory and write IndexFile as JSON', () => {
      const file: IndexFile = {
        meta: { model: 'all-MiniLM-L6-v2', builtAt: '2026-01-01T00:00:00.000Z', version: 2 },
        chunks: [
          { id: '1', sourceId: 'src1', text: 'text', vector384: [0.1] },
        ],
      };

      writeIndex('path/to/index.json', file);

      expect(mkdirSync).toHaveBeenCalledWith('path/to', { recursive: true });
      expect(writeFileSync).toHaveBeenCalledWith(
        'path/to/index.json',
        JSON.stringify(file),
        'utf-8'
      );
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.00 MB');
      expect(formatBytes(2097152)).toBe('2.00 MB');
    });
  });
});
