import { describe, it, expect, beforeEach } from 'vitest';
import { getFallback } from '../../src/core/fallback';
import type { AgentConfig } from '../../src/core/types';

describe('getFallback', () => {
  const baseConfig: AgentConfig = {
    name: 'Support Bot',
    contactUrl: '',
  };


  it('should return a message from the default pool when no fallback is provided', () => {
    const message = getFallback(baseConfig);
    expect(message).toBeDefined();
    expect(typeof message).toBe('string');
  });

  it('should rotate through the default pool', () => {
    // We don't know the exact starting index because of global state, 
    // but we can check if it changes and eventually repeats.
    const m1 = getFallback(baseConfig);
    const m2 = getFallback(baseConfig);
    const m3 = getFallback(baseConfig);
    const m4 = getFallback(baseConfig);
    
    expect(m1).not.toBe(m2);
    expect(m1).toBe(m4); // Default pool has 3 items
  });

  it('should use custom fallback pool if provided', () => {
    const config: AgentConfig = {
      ...baseConfig,
      fallbackPool: ['Custom 1', 'Custom 2'],
    };
    const m1 = getFallback(config);
    const m2 = getFallback(config);
    
    expect(['Custom 1', 'Custom 2']).toContain(m1);
    expect(['Custom 1', 'Custom 2']).toContain(m2);
    expect(m1).not.toBe(m2);
  });

  it('should use single fallback if provided', () => {
    const config: AgentConfig = {
      ...baseConfig,
      fallback: 'Single fallback',
    };
    const m = getFallback(config);
    expect(m).toBe('Single fallback');
  });

  it('should append contactUrl if provided', () => {
    const config: AgentConfig = {
      ...baseConfig,
      fallback: 'Help',
      contactUrl: 'https://example.com/contact',
    };
    const m = getFallback(config);
    expect(m).toBe('Help You can reach us at: https://example.com/contact');
  });
});
