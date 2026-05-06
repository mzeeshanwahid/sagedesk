import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { IndexFile } from '../core/types';

export function writeIndex(outputPath: string, file: IndexFile): void {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(file), 'utf-8');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
