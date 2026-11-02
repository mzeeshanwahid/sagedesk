import { renderHook, act } from '@testing-library/react';
import { useSageDesk } from '../../src/react/useSageDesk';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as retriever from '../../src/core/retriever';
import * as renderer from '../../src/core/renderer';
import * as fallback from '../../src/core/fallback';
import { EmbedderRuntime } from '../../src/core/embedder';

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

  it('local mode still loads the embedder and fetches the index', async () => {
    vi.mocked(retriever.fetchIndex).mockResolvedValue([{ text: 'data' }] as any);
    const { result } = renderHook(() => useSageDesk(config));

    await act(async () => {
      result.current.open();
    });

    expect(retriever.fetchIndex).toHaveBeenCalledWith('index.json');
    expect(EmbedderRuntime).toHaveBeenCalledTimes(1);
    expect(result.current.state.engineStatus).toBe('ready');
  });

  describe('LLM mode', () => {
    const llmConfig = {
      mode: 'llm' as const,
      endpoint: '/api/sagedesk',
      agent: { name: 'LLM Bot', suggestedChips: ['Pricing?'] },
    };

    function mockEndpoint(data: unknown) {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
      global.fetch = fetchMock as any;
      return fetchMock;
    }

    it('is ready on open without constructing the embedder or fetching an index', async () => {
      const { result } = renderHook(() => useSageDesk(llmConfig));

      await act(async () => {
        result.current.open();
      });

      expect(result.current.state.engineStatus).toBe('ready');
      expect(EmbedderRuntime).not.toHaveBeenCalled();
      expect(retriever.fetchIndex).not.toHaveBeenCalled();
      expect(result.current.chips).toEqual(['Pricing?']);
    });

    it('posts { query } with no queryVector key', async () => {
      const fetchMock = mockEndpoint({ answer: 'LLM answer', isFallback: false });
      const { result } = renderHook(() => useSageDesk(llmConfig));

      await act(async () => {
        result.current.open();
      });
      await act(async () => {
        await result.current.submit('  How much?  ');
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/sagedesk');
      expect(JSON.parse(init.body)).toEqual({ query: 'How much?' });
      expect(EmbedderRuntime).not.toHaveBeenCalled();
      expect(result.current.state.messages.at(-1)?.text).toBe('LLM answer');
    });

    it('shows the fallback text when the server reports isFallback', async () => {
      mockEndpoint({ answer: '', isFallback: true });
      const { result } = renderHook(() => useSageDesk(llmConfig));

      await act(async () => {
        result.current.open();
      });
      await act(async () => {
        await result.current.submit('Weather?');
      });

      const last = result.current.state.messages.at(-1);
      expect(last?.text).toBe('Fallback message');
      expect(last?.isFallback).toBe(true);
    });

    it('llm.embedQuery: true restores the 2.x flow (embedder loads, vector is sent)', async () => {
      const fetchMock = mockEndpoint({ answer: 'LLM answer', isFallback: false });
      const { result } = renderHook(() =>
        useSageDesk({ ...llmConfig, llm: { embedQuery: true } })
      );

      await act(async () => {
        result.current.open();
      });

      expect(EmbedderRuntime).toHaveBeenCalledTimes(1);
      const embedder = vi.mocked(EmbedderRuntime).mock.results[0].value;
      expect(embedder.load).toHaveBeenCalled();

      await act(async () => {
        await result.current.submit('How much?');
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.query).toBe('How much?');
      expect(body.queryVector).toHaveLength(1);
      expect(body.queryVector[0]).toBeCloseTo(0.1);
    });
  });
});
