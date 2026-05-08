// Supported embedding models. all-MiniLM-L6-v2 is the default and recommended for English.
export type SageDeskModel =
  | 'all-MiniLM-L6-v2'
  | 'bge-small-en-v1-5'
  | 'paraphrase-multilingual-MiniLM-L12-v2'
  | 'all-mpnet-base-v2';

export type Theme = 'classic' | 'light' | 'dark';

// Operating mode: 'local' runs entirely in the browser (default); 'llm' posts to the
// consumer's own backend which handles embedding, retrieval, and LLM synthesis.
export type SageDeskMode = 'local' | 'llm';

export interface AgentConfig {
  name: string;
  // Embedding model for semantic search. Defaults to all-MiniLM-L6-v2.
  // Must match the model used at build time.
  model?: SageDeskModel;
  greeting?: string;
  fallback?: string;
  fallbackPool?: string[];
  accentColor?: string;
  theme?: Theme;
  position?: 'bottom-right' | 'bottom-left';
  avatarUrl?: string;
  contactUrl?: string;
  suggestedChips?: string[];
}

export interface SearchConfig {
  minScore?: number;
  topK?: number;
}

export interface SageDeskConfig {
  // 'local' (default): all embedding and search runs in the browser via WASM.
  // 'llm': the widget POSTs queries to the consumer's own backend endpoint.
  mode?: SageDeskMode;
  // Required in local mode. URL to the pre-built vector index JSON file.
  indexUrl?: string;
  // Required in llm mode. Consumer's own backend endpoint that accepts POST { query }.
  endpoint?: string;
  agent: AgentConfig;
  search?: SearchConfig;
}

export interface KnowledgeEntry {
  id: string;
  topic?: string;
  // Legacy: single question (backward-compatible). Prefer queries[] for new entries.
  question?: string;
  // Query expansion: multiple phrasings that should all return this answer.
  // When provided, one indexed chunk is created per query variation.
  queries?: string[];
  answer: string;
  tags?: string[];
}

export interface KnowledgeFile {
  knowledge: KnowledgeEntry[];
}

export interface IndexChunk {
  id: string;
  sourceId: string;
  text: string;
  vector384: number[] | Float32Array;
  // vector768 is present only in indexes built with the legacy dual-model pipeline.
  // New indexes omit this field. Runtime search uses vector384 exclusively.
  vector768?: number[] | Float32Array;
  question?: string;
  textLower?: string;
}

// Metadata written into the index file by the CLI build command.
export interface IndexFileMeta {
  model: string;
  builtAt: string;
  version: number;
  dimensions?: number;
}

// The index file format written by the CLI.
// loadIndex() also accepts the legacy format (bare IndexChunk[]) for backward compatibility.
export interface IndexFile {
  meta: IndexFileMeta;
  chunks: IndexChunk[];
}

export interface SearchResult {
  chunk: IndexChunk;
  score: number;
}

export type FallbackReason = 'auth-error' | 'quota-exceeded' | 'timeout' | 'api-error' | 'malformed-response';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  isFallback?: boolean;
  fallbackReason?: FallbackReason;
  timestamp: Date;
}

export type EngineStatus =
  | 'idle'
  | 'loading-index'
  | 'loading-model'
  | 'ready'
  | 'error-index'
  | 'error-model'
  | 'degraded';

export interface EngineState {
  status: EngineStatus;
  error?: string;
}
