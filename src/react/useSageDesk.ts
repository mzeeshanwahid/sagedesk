import { useState, useEffect, useReducer, useCallback, useRef, useMemo } from 'react';
import { EmbedderRuntime } from '../core/embedder.js';
import { fetchIndex } from '../core/retriever.js';
import { retrieve } from '../core/retriever.js';
import { buildAnswer, extractChips } from '../core/renderer.js';
import { getFallback } from '../core/fallback.js';
import type {
  SageDeskConfig,
  IndexChunk,
  ChatMessage,
  EngineStatus,
} from '../core/types.js';

// ─── Fallback logging ─────────────────────────────────────────────────────────

function logFallbackWarning(reason?: string): void {
  if (!reason) return;

  const messages: Record<string, string> = {
    'auth-error': '[sagedesk] Support service authentication failed. Showing relevant knowledge instead.',
    'quota-exceeded': '[sagedesk] Support service quota exhausted. Showing relevant knowledge instead.',
    'timeout': '[sagedesk] Support service took too long to respond. Showing relevant knowledge instead.',
    'api-error': '[sagedesk] Support service error. Showing relevant knowledge instead.',
    'malformed-response': '[sagedesk] Support service returned invalid response. Showing relevant knowledge instead.',
  };

  console.warn(messages[reason] || '[sagedesk] Support service unavailable. Showing relevant knowledge instead.');
}

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  messages: ChatMessage[];
  isOpen: boolean;
  isTyping: boolean;
  engineStatus: EngineStatus;
  engineError: string | null;
  hasSentMessage: boolean;
}

type Action =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_ENGINE_STATUS'; payload: { status: EngineStatus; error?: string } }
  | { type: 'MARK_SENT' };

const initialState: State = {
  messages: [],
  isOpen: false,
  isTyping: false,
  engineStatus: 'idle',
  engineError: null,
  hasSentMessage: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true };
    case 'CLOSE':
      return { ...state, isOpen: false };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };
    case 'SET_ENGINE_STATUS':
      return {
        ...state,
        engineStatus: action.payload.status,
        engineError: action.payload.error ?? null,
      };
    case 'MARK_SENT':
      return { ...state, hasSentMessage: true };
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSageDeskReturn {
  state: State;
  chips: string[];
  open: () => void;
  close: () => void;
  submit: (text: string) => void;
}

export function useSageDesk(config: SageDeskConfig): UseSageDeskReturn {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Mirror engineStatus in a ref so polling loops always read the current
  // value without capturing a stale closure.
  const engineStatusRef = useRef<EngineStatus>('idle');
  engineStatusRef.current = state.engineStatus;

  const indexRef = useRef<IndexChunk[] | null>(null);
  const embedderRef = useRef<EmbedderRuntime | null>(null);
  const engineStartedRef = useRef(false);
  const msgCounterRef = useRef(0);
  const [chips, setChips] = useState<string[]>([]);

  const makeId = () => `msg-${++msgCounterRef.current}`;

  const addMessage = useCallback(
    (msg: Pick<ChatMessage, 'role' | 'text' | 'isFallback'>) => {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: { ...msg, id: makeId(), timestamp: new Date() },
      });
    },
    []
  );

  // Start engine once when widget first opens
  const startEngine = useCallback(async () => {
    if (engineStartedRef.current) return;
    engineStartedRef.current = true;

    // LLM mode: no local index or WASM model needed - mark ready immediately.
    if (config.mode === 'llm') {
      setChips(config.agent.suggestedChips ?? []);
      dispatch({ type: 'SET_ENGINE_STATUS', payload: { status: 'ready' } });
      return;
    }

    dispatch({ type: 'SET_ENGINE_STATUS', payload: { status: 'loading-index' } });

    try {
      indexRef.current = await fetchIndex(config.indexUrl!);
    } catch (err) {
      console.warn('[sagedesk] Failed to load knowledge index from', config.indexUrl, '-', err);
      dispatch({
        type: 'SET_ENGINE_STATUS',
        payload: { status: 'error-index', error: String(err) },
      });
      addMessage({
        role: 'bot',
        text: "I'm having trouble loading right now. Please try again in a moment.",
      });
      return;
    }

    setChips(extractChips(indexRef.current, config.agent.suggestedChips));

    dispatch({ type: 'SET_ENGINE_STATUS', payload: { status: 'loading-model' } });

    try {
      embedderRef.current = new EmbedderRuntime();
      await embedderRef.current.load(config.agent.model);
      dispatch({ type: 'SET_ENGINE_STATUS', payload: { status: 'ready' } });
    } catch (err) {
      console.warn('[sagedesk] WASM model failed to load, falling back to keyword search -', err);
      embedderRef.current = new EmbedderRuntime();
      dispatch({ type: 'SET_ENGINE_STATUS', payload: { status: 'degraded' } });
    }
  }, [config.mode, config.indexUrl, config.agent.suggestedChips, addMessage]);

  const greetingShownRef = useRef(false);

  const open = useCallback(() => {
    dispatch({ type: 'OPEN' });

    if (!greetingShownRef.current) {
      greetingShownRef.current = true;
      addMessage({
        role: 'bot',
        text: config.agent.greeting ?? 'Hey, how can I help you today?',
      });
    }

    startEngine();
  }, [config.agent.greeting, addMessage, startEngine]);

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  // Uses engineStatusRef so the polling check always reads the live value,
  // not the stale closure value captured when waitForEngine was first called.
  const waitForEngine = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        const s = engineStatusRef.current;
        if (
          s === 'ready' ||
          s === 'degraded' ||
          s === 'error-index' ||
          s === 'error-model'
        ) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }, []);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const typingStart = Date.now();

      dispatch({ type: 'MARK_SENT' });
      addMessage({ role: 'user', text: trimmed });
      dispatch({ type: 'SET_TYPING', payload: true });

      const currentStatus = engineStatusRef.current;
      if (
        currentStatus !== 'ready' &&
        currentStatus !== 'degraded' &&
        currentStatus !== 'error-index' &&
        currentStatus !== 'error-model'
      ) {
        await waitForEngine();
      }

      let botText: string;
      let isFallback = false;
      let fallbackReason: string | undefined;
      let retrievalMode: 'vector' | 'keyword' = 'keyword';

      if (config.mode === 'llm') {
        // LLM mode: POST query to the consumer's own backend endpoint.
        if (!config.endpoint) {
          console.warn('[sagedesk] LLM mode requires an "endpoint" prop.');
          botText = getFallback(config.agent);
          isFallback = true;
        } else {
          try {
            const res = await fetch(config.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: trimmed }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as {
              answer: string;
              isFallback: boolean;
              fallbackReason?: string;
            };
            if (data.isFallback || !data.answer) {
              fallbackReason = data.fallbackReason;
              logFallbackWarning(fallbackReason);
              botText = getFallback(config.agent);
              isFallback = true;
            } else {
              botText = data.answer;
            }
          } catch (err) {
            console.warn('[sagedesk] Support service unavailable. Using cached knowledge instead.');
            botText = getFallback(config.agent);
            isFallback = true;
          }
        }
      } else if (!indexRef.current) {
        botText = getFallback(config.agent);
        isFallback = true;
      } else {
        try {
          const res = await retrieve(
            trimmed,
            indexRef.current,
            embedderRef.current!,
            config.search
          );
          retrievalMode = res.mode;
          if (res.results.length > 0) {
            botText = buildAnswer(res.results);
          } else {
            botText = getFallback(config.agent);
            isFallback = true;
          }
        } catch (err) {
          console.warn('[sagedesk] Query failed, showing fallback -', err);
          botText = getFallback(config.agent);
          isFallback = true;
        }
      }

      // In LLM mode the real network+LLM latency already provides natural delay.
      // In local mode apply an artificial "thinking" pause for a more natural feel.
      if (config.mode !== 'llm') {
        const elapsed = Date.now() - typingStart;
        const delayBase = (retrievalMode === 'keyword' || isFallback) ? 800 : 3000;
        const minTypingMs = delayBase + Math.random() * 2000;
        const remaining = minTypingMs - elapsed;
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      }

      dispatch({ type: 'SET_TYPING', payload: false });
      addMessage({ role: 'bot', text: botText, isFallback });
    },
    [addMessage, waitForEngine, config.agent, config.search]
  );

  // Keyboard: Escape closes
  useEffect(() => {
    if (!state.isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.isOpen, close]);

  const activeChips = useMemo(() => {
    const askedTexts = new Set(
      state.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.text.toLowerCase().trim())
    );
    return chips.filter((chip) => !askedTexts.has(chip.toLowerCase().trim()));
  }, [chips, state.messages]);

  return { state, chips: activeChips, open, close, submit };
}
