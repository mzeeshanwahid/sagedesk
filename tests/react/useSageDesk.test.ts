import { renderHook, act } from '@testing-library/react';
import { useSageDesk } from '../../src/react/useSageDesk';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as retriever from '../../src/core/retriever';
import * as renderer from '../../src/core/renderer';
import * as fallback from '../../src/core/fallback';

vi.mock('../../src/core/retriever', () => ({
  fetchIndex: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock('../../src/core/renderer', () => ({
  buildAnswer: vi.fn(),
  extractChips: vi.fn().mockReturnValue(['Chip 1']),
}));

vi.mock('../../src/core/fallback', () => ({
  getFallback: vi.fn().mockReturnValue('Fallback message'),
}));

vi.mock('../../src/core/embedder', () => {
  return {
    EmbedderRuntime: vi.fn().mockImplementation(() => ({
      load: vi.fn().mockResolvedValue(undefined),
      embed: vi.fn().mockResolvedValue(new Float32Array([0.1])),
      isReady: true,
    })),
  };
});

describe('useSageDesk', () => {
  const config = {
    indexUrl: 'index.json',
    agent: {
      name: 'React Bot',
      greeting: 'React Hello!',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useSageDesk(config));
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.engineStatus).toBe('idle');
  });

  it('should open and start engine', async () => {
    vi.mocked(retriever.fetchIndex).mockResolvedValue([{ text: 'data' }] as any);
    
    const { result } = renderHook(() => useSageDesk(config));
    
    await act(async () => {
      result.current.open();
    });
    
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.messages[0].text).toBe('React Hello!');
    expect(retriever.fetchIndex).toHaveBeenCalledWith('index.json');
  });

  it('should handle submit', async () => {
    vi.useFakeTimers();
    vi.mocked(retriever.fetchIndex).mockResolvedValue([{ text: 'data' }] as any);
    vi.mocked(retriever.retrieve).mockResolvedValue({ results: [{ chunk: { text: 'Ans' } }], mode: 'vector' } as any);
    vi.mocked(renderer.buildAnswer).mockReturnValue('React Answer');

    const { result } = renderHook(() => useSageDesk(config));
    
    await act(async () => {
      result.current.open();
    });

    await act(async () => {
      result.current.submit('Question?');
    });

    expect(result.current.state.isTyping).toBe(true);
    // messages: [greeting, user]
    expect(result.current.state.messages).toHaveLength(2);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.state.isTyping).toBe(false);
    expect(result.current.state.messages).toHaveLength(3);
    expect(result.current.state.messages[2].text).toBe('React Answer');
    
    vi.useRealTimers();
  });

  it('should close', async () => {
    vi.mocked(retriever.fetchIndex).mockResolvedValue([{ text: 'data' }] as any);
    const { result } = renderHook(() => useSageDesk(config));
    
    await act(async () => {
      result.current.open();
    });
    
    expect(result.current.state.isOpen).toBe(true);
    
    act(() => {
      result.current.close();
    });

    expect(result.current.state.isOpen).toBe(false);
  });

  it('should filter chips in useSageDesk', async () => {
    vi.mocked(retriever.fetchIndex).mockResolvedValue([{ text: 'data' }] as any);
    vi.mocked(renderer.extractChips).mockReturnValue(['Chip 1', 'Chip 2']);

    const { result } = renderHook(() => useSageDesk(config));

    await act(async () => {
      result.current.open();
    });

    expect(result.current.chips).toHaveLength(2);

    await act(async () => {
      result.current.submit('Chip 1');
    });

    expect(result.current.chips).toHaveLength(1);
    expect(result.current.chips[0]).toBe('Chip 2');
  });
});
