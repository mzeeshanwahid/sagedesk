import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useSageDesk } from './useSageDesk.js';
import { parseMarkdown } from './markdownUtils.js';
import type { SageDeskConfig, ChatMessage, Theme, SageDeskMode } from '../core/types.js';

// ─── Per-theme CSS injection ──────────────────────────────────────────────────
// Only the styles for the active theme are injected, keeping the runtime
// stylesheet small. Each block includes shared keyframes + theme-specific rules.

const STYLE_ID = 'sagedesk-widget-styles';

const SHARED = `
  @keyframes sd-bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30%           { transform: translateY(-5px); }
  }
  @keyframes sd-panel-open {
    from { transform: scale(0.94) translateY(6px); opacity: 0; }
    to   { transform: scale(1)    translateY(0);   opacity: 1; }
  }
  @keyframes sd-panel-close {
    from { transform: scale(1)    translateY(0);   opacity: 1; }
    to   { transform: scale(0.94) translateY(6px); opacity: 0; }
  }
  .sd-r-opening { animation: sd-panel-open  200ms cubic-bezier(0.34,1.56,0.64,1) both; }
  .sd-r-closing { animation: sd-panel-close 150ms ease-in both; }
  .sd-r-dot-1   { animation: sd-bounce 1.2s ease-in-out          infinite; }
  .sd-r-dot-2   { animation: sd-bounce 1.2s ease-in-out 0.2s     infinite; }
  .sd-r-dot-3   { animation: sd-bounce 1.2s ease-in-out 0.4s     infinite; }
  .sd-r-scrollable {
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  .sd-r-scrollable::-webkit-scrollbar { display: none !important; }
  .sd-r-scrollable > * { flex-shrink: 0 !important; }
  .sd-r-markdown h1, .sd-r-markdown h2, .sd-r-markdown h3, .sd-r-markdown h4, .sd-r-markdown h5, .sd-r-markdown h6 {
    margin: 12px 0 8px 0 !important; font-weight: 600 !important; line-height: 1.3 !important;
  }
  .sd-r-markdown h1 { font-size: 1.3em !important; }
  .sd-r-markdown h2 { font-size: 1.2em !important; }
  .sd-r-markdown h3 { font-size: 1.1em !important; }
  .sd-r-markdown h4, .sd-r-markdown h5, .sd-r-markdown h6 { font-size: 1em !important; }
  .sd-r-markdown strong { font-weight: 600 !important; }
  .sd-r-markdown em { font-style: italic !important; }
  .sd-r-markdown u { text-decoration: underline !important; }
  .sd-r-markdown ul, .sd-r-markdown ol { margin: 8px 0 !important; padding-left: 20px !important; }
  .sd-r-markdown li { margin: 4px 0 !important; }
  .sd-r-markdown blockquote { margin: 8px 0 !important; padding-left: 12px !important; border-left: 3px solid currentColor !important; opacity: 0.8 !important; }
  .sd-r-markdown code { font-family: 'Monaco', 'Courier New', monospace !important; font-size: 0.9em !important; padding: 2px 4px !important; background: rgba(0,0,0,0.05) !important; border-radius: 3px !important; }
  .sd-r-markdown pre { background: rgba(0,0,0,0.05) !important; padding: 8px 10px !important; border-radius: 6px !important; overflow-x: auto !important; margin: 8px 0 !important; }
  .sd-r-markdown pre code { background: none !important; padding: 0 !important; }
  .sd-r-markdown hr { border: none !important; border-top: 1px solid currentColor !important; opacity: 0.3 !important; margin: 10px 0 !important; }
  .sd-r-markdown a { text-decoration: underline !important; opacity: 0.9 !important; }
  .sd-r-markdown a:hover { opacity: 1 !important; }
  .sd-r-markdown p { margin: 6px 0 !important; }
  .sd-r-markdown > *:first-child { margin-top: 0 !important; }
  .sd-r-markdown > *:last-child { margin-bottom: 0 !important; }
  @media (max-width: 420px) {
    .sd-r-panel {
      bottom: 0 !important; right: 0 !important; left: 0 !important;
      width: auto !important; max-width: 100% !important;
      border-radius: 20px 20px 0 0 !important;
      max-height: 85vh !important;
      transform-origin: bottom center !important;
    }
  }
`;

const THEME_CSS: Record<Theme, string> = {
  classic: `${SHARED}
    .sd-r-trigger:hover  { transform: scale(1.06) !important; }
    .sd-r-close-btn:hover { background: rgba(255,255,255,0.22) !important; }
    .sd-r-chip:hover     { opacity: 0.8; }
    .sd-r-send:hover     { opacity: 0.85; }
    .sd-r-send:active    { transform: scale(0.95); }
    .sd-r-input:focus    { outline: none; }
    .sd-r-input::placeholder { color: #a8a8b0; }
  `,
  light: `${SHARED}
    .sd-r-trigger-light:hover { box-shadow: 0 16px 32px -10px rgba(40,30,90,0.24),0 2px 10px rgba(40,30,90,0.08) !important; }
    .sd-r-chip-light:hover   { opacity: 0.75; }
    .sd-r-send:hover  { opacity: 0.85; }
    .sd-r-send:active { transform: scale(0.95); }
    .sd-r-input:focus { outline: none; }
    .sd-r-input::placeholder { color: #a8a89e; }
  `,
  dark: `${SHARED}
    @keyframes sd-blink { 0%,100%{opacity:1} 50%{opacity:0} }
    .sd-r-cursor  { animation: sd-blink 1s infinite; }
    .sd-r-trigger:hover  { transform: scale(1.04) !important; }
    .sd-r-prompt:hover   { background: rgba(255,255,255,0.07) !important; }
    .sd-r-send:hover  { opacity: 0.85; }
    .sd-r-send:active { transform: scale(0.95); }
    .sd-r-input:focus { outline: none; }
    .sd-r-input::placeholder { color: rgba(255,255,255,0.35); }
  `,
};

function injectStyles(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const id = `${STYLE_ID}-${theme}`;
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = THEME_CSS[theme];
  document.head.prepend(style);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconChat = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7A2.5 2.5 0 0116.5 16H11l-4 3.5V16H7.5A2.5 2.5 0 015 13.5v-7z"
      stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
    />
  </svg>
);

const IconSend = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 12L20 4l-4 16-4-7-8-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const IconClose = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const IconBot = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="9" cy="13.5" r="1.5" fill="currentColor" />
    <circle cx="15" cy="13.5" r="1.5" fill="currentColor" />
    <path d="M9.5 16.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M12 8V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="4" r="1.2" fill="currentColor" />
  </svg>
);

const IconPerson = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 12.5a4 4 0 100-8 4 4 0 000 8z" />
    <path d="M5 20.5c0-3.5 3.13-6 7-6s7 2.5 7 6" />
  </svg>
);

// ─── Shared sub-components ────────────────────────────────────────────────────

const PoweredBy = ({ dark = false }: { dark?: boolean }) => (
  <div style={{
    fontSize: '11px',
    color: dark ? 'rgba(255,255,255,0.35)' : '#a8a8b0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  }}>
    Powered by{' '}
    <a
      href="https://github.com/mzeeshanwahid/sagedesk"
      target="_blank"
      rel="noopener"
      style={{
        color: dark ? 'rgba(255,255,255,0.7)' : '#5a5a64',
        fontWeight: 500,
        textDecoration: 'none',
      }}
    >
      sagedesk
    </a>
  </div>
);

// ─── Classic theme components ─────────────────────────────────────────────────

const ClassicMessageBubble = React.memo(function ClassicMessageBubble({ msg, accent }: { msg: ChatMessage; accent: string }) {
  const isBot = msg.role === 'bot';
  const renderedHtml = useMemo(() => isBot ? parseMarkdown(msg.text) : msg.text, [isBot, msg.text]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-start' : 'flex-end', gap: '4px' }}>
      {msg.isFallback && (
        <p style={{ fontSize: '11px', fontWeight: 500, color: '#9b9aa3', margin: 0, padding: '0 4px', fontFamily: 'inherit' }}>
          Not sure about that one
        </p>
      )}
      <div style={{
        maxWidth: '82%',
        padding: '10px 14px',
        fontSize: '14px',
        lineHeight: 1.5,
        borderRadius: isBot ? '16px 16px 16px 6px' : '16px 16px 6px 16px',
        background: isBot ? '#fff' : accent,
        color: isBot ? '#1a1a2e' : '#fff',
        border: isBot ? '1px solid rgba(20,20,40,0.06)' : 'none',
        boxShadow: isBot
          ? '0 1px 2px rgba(20,20,40,0.04)'
          : `0 6px 16px -6px color-mix(in oklab, ${accent} 60%, transparent)`,
        wordBreak: 'break-word',
        fontFamily: 'inherit',
      }} className="sd-r-markdown">
        {isBot ? (
          <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
        )}
      </div>
      <span style={{
        fontSize: '11px', color: '#a8a8b0', marginTop: '2px',
        padding: isBot ? '0 0 0 4px' : '0 4px 0 0',
        fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit',
      }}>just now</span>
    </div>
  );
});

function ClassicTypingIndicator() {
  const dot: CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#c8c8ce', display: 'inline-block' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
      <div style={{
        padding: '10px 14px', borderRadius: '16px 16px 16px 6px',
        background: '#fff', border: '1px solid rgba(20,20,40,0.06)',
        boxShadow: '0 1px 2px rgba(20,20,40,0.04)',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <span style={dot} className="sd-r-dot-1" />
        <span style={dot} className="sd-r-dot-2" />
        <span style={dot} className="sd-r-dot-3" />
      </div>
    </div>
  );
}

// ─── Light theme components ───────────────────────────────────────────────────

const LightMessageBubble = React.memo(function LightMessageBubble({ msg, accent, agentName }: { msg: ChatMessage; accent: string; agentName: string }) {
  const isBot = msg.role === 'bot';
  const renderedHtml = useMemo(() => isBot ? parseMarkdown(msg.text) : msg.text, [isBot, msg.text]);

  if (isBot) {
    return (
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #fff))`,
          flexShrink: 0, marginTop: '2px',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e', fontFamily: 'inherit' }}>{agentName}</span>
            <span style={{ fontSize: '11px', color: '#a8a89e', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>just now</span>
          </div>
          {msg.isFallback && (
            <p style={{ fontSize: '11px', color: '#9b9aa3', margin: '0 0 4px', fontFamily: 'inherit' }}>Not sure about that one</p>
          )}
          <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#2a2a36', fontFamily: 'inherit', wordBreak: 'break-word' }} className="sd-r-markdown">
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        maxWidth: '78%', padding: '11px 15px', fontSize: '14px', lineHeight: 1.5,
        borderRadius: '16px 16px 4px 16px',
        background: `color-mix(in oklab, ${accent} 10%, white)`,
        color: accent,
        border: `1px solid color-mix(in oklab, ${accent} 22%, transparent)`,
        fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
      }}>
        {msg.text}
      </div>
    </div>
  );
});

function LightTypingIndicator({ accent }: { accent: string }) {
  const dot: CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#c4c4be', display: 'inline-block' };
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #fff))`,
        flexShrink: 0, marginTop: '2px',
      }} />
      <div style={{
        padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
        background: '#fff', border: '1px solid rgba(20,20,40,0.07)',
        boxShadow: '0 1px 2px rgba(20,20,40,0.04)',
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        <span style={dot} className="sd-r-dot-1" />
        <span style={dot} className="sd-r-dot-2" />
        <span style={dot} className="sd-r-dot-3" />
      </div>
    </div>
  );
}

// ─── Dark theme components ────────────────────────────────────────────────────

const DarkMessageBubble = React.memo(function DarkMessageBubble({ msg, accent }: { msg: ChatMessage; accent: string }) {
  const isBot = msg.role === 'bot';
  const renderedHtml = useMemo(() => isBot ? parseMarkdown(msg.text) : msg.text, [isBot, msg.text]);

  return (
    <div style={{
      maxWidth: '85%',
      padding: '12px 14px',
      fontSize: '14px',
      lineHeight: isBot ? 1.6 : 1.5,
      borderRadius: isBot ? '14px 14px 14px 6px' : '14px 14px 6px 14px',
      background: isBot
        ? 'rgba(255,255,255,0.05)'
        : `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 75%, #1a1340))`,
      border: isBot ? '1px solid rgba(255,255,255,0.06)' : 'none',
      color: isBot ? 'rgba(255,255,255,0.92)' : '#fff',
      alignSelf: isBot ? 'flex-start' : 'flex-end',
      boxShadow: isBot ? 'none' : `0 8px 20px -8px color-mix(in oklab, ${accent} 70%, transparent)`,
      wordBreak: 'break-word',
      fontFamily: 'inherit',
    }} className={isBot ? 'sd-r-markdown' : ''}>
      {msg.isFallback && (
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>
          Not sure about that one
        </span>
      )}
      {isBot ? (
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      ) : (
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
      )}
    </div>
  );
});

function DarkTypingIndicator() {
  const dot: CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display: 'inline-block' };
  return (
    <div style={{
      maxWidth: '85%', padding: '12px 14px',
      borderRadius: '14px 14px 14px 6px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.06)',
      alignSelf: 'flex-start',
      display: 'flex', alignItems: 'center', gap: '4px',
    }}>
      <span style={dot} className="sd-r-dot-1" />
      <span style={dot} className="sd-r-dot-2" />
      <span style={dot} className="sd-r-dot-3" />
    </div>
  );
}

// ─── Theme render functions ───────────────────────────────────────────────────

interface ThemeRenderProps {
  agent: SageDeskConfig['agent'];
  state: ReturnType<typeof useSageDesk>['state'];
  chips: string[];
  accent: string;
  isLeft: boolean;
  inputValue: string;
  setInputValue: (v: string) => void;
  handleClose: () => void;
  handleSubmit: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  isClosing: boolean;
  panelClass: string;
  showChips: boolean;
  showPoweredBy: boolean;
  threadRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
  open: () => void;
  submit: (text: string) => void;
}

function ClassicTheme(p: ThemeRenderProps) {
  const {
    agent, state, chips, accent, isLeft, inputValue, setInputValue,
    handleClose, handleSubmit, handleKeyDown, isClosing, panelClass,
    showChips, showPoweredBy, threadRef, inputRef, triggerRef, open, submit,
  } = p;

  const side = isLeft ? 'left' : 'right';

  const triggerStyle: CSSProperties = {
    position: 'fixed', bottom: '28px', [side]: '28px',
    width: '56px', height: '56px', borderRadius: '50%',
    background: `linear-gradient(135deg, ${accent} 0%, color-mix(in oklab, ${accent} 78%, #1a1340) 100%)`,
    border: 'none', color: '#fff', cursor: 'pointer',
    display: 'grid', placeItems: 'center',
    zIndex: 9999, padding: 0, transition: 'transform 150ms ease',
    boxShadow: `0 14px 28px -6px color-mix(in oklab, ${accent} 55%, transparent), 0 4px 10px rgba(40,30,90,0.15)`,
  };

  const panelStyle: CSSProperties = {
    position: 'fixed', bottom: '96px', [side]: '28px',
    width: '380px', height: '580px', maxHeight: '580px', borderRadius: '20px',
    background: '#ffffff',
    boxShadow: '0 1px 0 rgba(20,20,40,0.04), 0 24px 48px -16px rgba(40,30,90,0.22), 0 4px 14px rgba(40,30,90,0.08)',
    border: '1px solid rgba(20,20,40,0.04)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    zIndex: 9999, transformOrigin: isLeft ? 'bottom left' : 'bottom right',
  };

  const headerGrad = `linear-gradient(135deg, ${accent} 0%, color-mix(in oklab, ${accent} 78%, #1a1340) 100%)`;

  return (
    <>
      <button ref={triggerRef} style={triggerStyle} className="sd-r-trigger" onClick={state.isOpen ? handleClose : open}
        aria-label="Open support chat" aria-expanded={state.isOpen}>
        <IconChat size={22} />
      </button>

      {(state.isOpen || isClosing) && (
        <div style={panelStyle} className={`sd-r-panel ${panelClass}`} role="dialog" aria-label={agent.name}>
          {/* Header */}
          <div style={{ padding: '18px 20px', background: headerGrad, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 40, height: 40 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                {agent.avatarUrl
                  ? <img src={agent.avatarUrl} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <IconPerson size={20} />}
              </div>
              <div style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', boxShadow: `0 0 0 2.5px ${accent}` }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>{agent.name}</div>
              <div style={{ fontSize: '12px', opacity: 0.85, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 0 2px rgba(74,222,128,0.25)' }} />
                Typically replies in under a minute
              </div>
            </div>
            <button className="sd-r-close-btn" onClick={handleClose} aria-label="Close chat" style={{
              background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff',
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              display: 'grid', placeItems: 'center', padding: 0, transition: 'background 120ms',
            }}>
              <IconClose size={14} />
            </button>
          </div>

          {/* Thread */}
          <div ref={threadRef} role="log" aria-live="polite" aria-label="Chat messages" style={{
            flex: 1, padding: '22px 18px 18px', overflowY: 'auto',
            background: '#fbfbfa', display: 'flex', flexDirection: 'column', gap: '18px',
            scrollbarWidth: 'thin', overscrollBehavior: 'contain',
          }}>
            {state.messages.map(msg => <ClassicMessageBubble key={msg.id} msg={msg} accent={accent} />)}
            {state.isTyping && <ClassicTypingIndicator />}
          </div>

          {/* Suggested chips */}
          {showChips && (
            <div style={{ padding: state.hasSentMessage ? '0 0 16px' : '0 18px 16px', background: '#fbfbfa', flexShrink: 0 }}>
              <div style={{
                fontSize: '11px', color: '#9b9aa3', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500,
                paddingLeft: state.hasSentMessage ? 18 : 4, marginBottom: '6px'
              }}>
                Suggested
              </div>
              <div className={state.hasSentMessage ? 'sd-r-scrollable' : ''} style={{
                display: 'flex', gap: '6px', flexWrap: state.hasSentMessage ? 'nowrap' : 'wrap',
                padding: state.hasSentMessage ? '0 18px' : 0
              }}>
                {chips.map(chip => (
                  <button key={chip} className="sd-r-chip" onClick={() => { setInputValue(''); submit(chip); }} style={{
                    fontSize: '12.5px', padding: '7px 12px', borderRadius: '999px',
                    background: '#fff', border: `1px solid color-mix(in oklab, ${accent} 24%, transparent)`,
                    color: accent, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
                    letterSpacing: '-0.005em',
                  }}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <div style={{ padding: '14px 14px 16px', borderTop: '1px solid rgba(20,20,40,0.06)', background: '#fff', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#f5f4f0', borderRadius: '12px', padding: '5px 6px 5px 14px',
              border: `1px solid ${inputValue ? `color-mix(in oklab, ${accent} 30%, transparent)` : 'transparent'}`,
              boxShadow: inputValue ? `0 0 0 4px color-mix(in oklab, ${accent} 12%, transparent)` : 'none',
              transition: 'border-color .15s, box-shadow .15s',
            }}>
              <input ref={inputRef} value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                className="sd-r-input"
                aria-label="Type your question"
                autoComplete="off"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', padding: '8px 0', fontFamily: 'inherit', color: '#1a1a2e' }}
              />
              <button className="sd-r-send" onClick={handleSubmit} aria-label="Send message" style={{
                width: 32, height: 32, borderRadius: 8, padding: 0,
                background: inputValue ? accent : `color-mix(in oklab, ${accent} 22%, #e5e3dc)`,
                border: 'none', color: '#fff', cursor: 'pointer',
                display: 'grid', placeItems: 'center', transition: 'background .15s',
              }}>
                <IconSend size={14} />
              </button>
            </div>
            {showPoweredBy && <div style={{ marginTop: '10px' }}><PoweredBy /></div>}
          </div>
        </div>
      )}
    </>
  );
}

function LightTheme(p: ThemeRenderProps) {
  const {
    agent, state, chips, accent, isLeft, inputValue, setInputValue,
    handleClose, handleSubmit, handleKeyDown, isClosing, panelClass,
    showChips, showPoweredBy, threadRef, inputRef, triggerRef, open, submit,
  } = p;

  const side = isLeft ? 'left' : 'right';

  const triggerStyle: CSSProperties = {
    position: 'fixed', bottom: '28px', [side]: '28px',
    height: '52px', padding: '0 8px 0 20px', borderRadius: '999px',
    background: '#fdfcf9', border: '1px solid rgba(20,20,40,0.08)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
    boxShadow: '0 12px 26px -8px rgba(40,30,90,0.18), 0 2px 8px rgba(40,30,90,0.06)',
    zIndex: 9999, fontFamily: 'inherit', transition: 'box-shadow 150ms ease',
  };

  const panelStyle: CSSProperties = {
    position: 'fixed', bottom: '92px', [side]: '28px',
    width: '400px', height: '580px', maxHeight: '580px', borderRadius: '22px',
    background: '#fdfcf9',
    boxShadow: '0 1px 0 rgba(20,20,40,0.04), 0 30px 60px -20px rgba(40,30,90,0.18), 0 6px 16px rgba(40,30,90,0.06)',
    border: '1px solid rgba(20,20,40,0.05)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    zIndex: 9999, transformOrigin: isLeft ? 'bottom left' : 'bottom right',
  };

  return (
    <>
      <button ref={triggerRef} style={triggerStyle} className="sd-r-trigger-light" onClick={state.isOpen ? handleClose : open}
        aria-label="Open support chat" aria-expanded={state.isOpen}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>Chat with us</span>
          <span style={{ fontSize: '11px', color: '#9b9aa3', marginTop: '2px' }}>We typically reply in 1m</span>
        </span>
        <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: accent, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <IconChat size={18} />
        </span>
      </button>

      {(state.isOpen || isClosing) && (
        <div style={panelStyle} className={`sd-r-panel ${panelClass}`} role="dialog" aria-label={agent.name}>
          {/* Header */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(20,20,40,0.05)', display: 'flex', alignItems: 'center', gap: '12px', background: '#fdfcf9', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, #fff))`,
              display: 'grid', placeItems: 'center', overflow: 'hidden', color: '#fff',
            }}>
              {agent.avatarUrl
                ? <img src={agent.avatarUrl} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <IconPerson size={16} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#1a1a2e', letterSpacing: '-0.01em' }}>{agent.name}</div>
              <div style={{ fontSize: '12px', color: '#7a7a82', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                Online · replies in under a minute
              </div>
            </div>
            <button onClick={handleClose} aria-label="Close chat" style={{
              background: 'transparent', border: 'none', color: '#9b9aa3',
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              display: 'grid', placeItems: 'center', padding: 0,
            }}>
              <IconClose size={16} />
            </button>
          </div>

          {/* Thread */}
          <div ref={threadRef} role="log" aria-live="polite" aria-label="Chat messages" style={{
            flex: 1, padding: '22px 20px 16px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '22px',
            scrollbarWidth: 'thin', overscrollBehavior: 'contain',
          }}>
            {state.messages.map(msg => <LightMessageBubble key={msg.id} msg={msg} accent={accent} agentName={agent.name} />)}
            {state.isTyping && <LightTypingIndicator accent={accent} />}
          </div>

          {/* Chips */}
          {showChips && (
            <div className={state.hasSentMessage ? 'sd-r-scrollable' : ''} style={{
              padding: '0 20px 14px', display: 'flex',
              flexWrap: state.hasSentMessage ? 'nowrap' : 'wrap',
              gap: '6px', flexShrink: 0
            }}>
              {chips.map(chip => (
                <button key={chip} className="sd-r-chip-light" onClick={() => { setInputValue(''); submit(chip); }} style={{
                  fontSize: '12px', padding: '5px 10px', borderRadius: '6px',
                  background: '#f4f3ee', border: 'none', color: '#5a5a64',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}>
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Composer */}
          <div style={{ padding: '14px', borderTop: '1px solid rgba(20,20,40,0.05)', background: '#fdfcf9', flexShrink: 0 }}>
            <div style={{
              background: '#fff',
              border: `1px solid ${inputValue ? `color-mix(in oklab, ${accent} 40%, transparent)` : 'rgba(20,20,40,0.1)'}`,
              borderRadius: '14px', padding: '10px 12px',
              transition: 'border-color .15s, box-shadow .15s',
              boxShadow: inputValue ? `0 0 0 4px color-mix(in oklab, ${accent} 12%, transparent)` : 'none',
            }}>
              <input ref={inputRef} value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                className="sd-r-input"
                aria-label="Type your question"
                autoComplete="off"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontFamily: 'inherit', color: '#1a1a2e' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', gap: '6px' }}>
                <div style={{ flex: 1 }} />
                <button className="sd-r-send" onClick={handleSubmit} aria-label="Send message" style={{
                  width: 28, height: 28, borderRadius: 7, padding: 0,
                  background: inputValue ? accent : '#e8e7e0',
                  color: inputValue ? '#fff' : '#a8a89e',
                  border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center',
                  transition: 'background .15s',
                }}>
                  <IconSend size={13} />
                </button>
              </div>
            </div>
            {showPoweredBy && <div style={{ marginTop: '10px' }}><PoweredBy /></div>}
          </div>
        </div>
      )}
    </>
  );
}

function DarkTheme(p: ThemeRenderProps) {
  const {
    agent, state, chips, accent, isLeft, inputValue, setInputValue,
    handleClose, handleSubmit, handleKeyDown, isClosing, panelClass,
    showChips, showPoweredBy, threadRef, inputRef, triggerRef, open, submit,
  } = p;

  const side = isLeft ? 'left' : 'right';

  const triggerStyle: CSSProperties = {
    position: 'fixed', bottom: '28px', [side]: '28px',
    width: '60px', height: '60px', borderRadius: '50%',
    background: `linear-gradient(135deg, color-mix(in oklab, ${accent} 70%, #1a1340), #1a1a2e)`,
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
    zIndex: 9999, padding: 0, transition: 'transform 150ms ease',
    boxShadow: '0 16px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
  };

  const glowStyle: CSSProperties = {
    position: 'fixed', bottom: '18px', [side]: '18px',
    width: '80px', height: '80px', borderRadius: '50%',
    background: `radial-gradient(circle, color-mix(in oklab, ${accent} 50%, transparent), transparent 70%)`,
    filter: 'blur(10px)', pointerEvents: 'none', zIndex: 9998,
  };

  const panelStyle: CSSProperties = {
    position: 'fixed', bottom: '100px', [side]: '28px',
    width: '380px', height: '580px', maxHeight: '580px', borderRadius: '22px',
    background: 'rgba(18, 16, 32, 0.86)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: '0 30px 60px -20px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    zIndex: 9999, color: '#fff',
    transformOrigin: isLeft ? 'bottom left' : 'bottom right',
  };

  return (
    <>
      {/* Ambient launcher glow */}
      <div style={glowStyle} aria-hidden="true" />

      <button ref={triggerRef} style={triggerStyle} className="sd-r-trigger" onClick={state.isOpen ? handleClose : open}
        aria-label="Open support chat" aria-expanded={state.isOpen}>
        <IconBot size={22} />
      </button>

      {(state.isOpen || isClosing) && (
        <div style={panelStyle} className={`sd-r-panel ${panelClass}`} role="dialog" aria-label={agent.name}>
          {/* Ambient top glow inside panel */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 200, pointerEvents: 'none',
            background: `radial-gradient(ellipse 80% 100% at 50% 0%, color-mix(in oklab, ${accent} 40%, transparent) 0%, transparent 70%)`,
          }} />

          {/* Header */}
          <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', overflow: 'hidden',
                background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 50%, #fff))`,
                boxShadow: `0 0 24px color-mix(in oklab, ${accent} 50%, transparent)`,
              }}>
                {agent.avatarUrl
                  ? <img src={agent.avatarUrl} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <IconBot size={16} />}
              </div>
              <div style={{ position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 2.5px rgba(18,16,32,1)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em' }}>{agent.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                Trained on this site · always on
              </div>
            </div>
            <button onClick={handleClose} aria-label="Close chat" style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)', width: 30, height: 30, borderRadius: 8,
              cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0,
            }}>
              <IconClose size={14} />
            </button>
          </div>

          {/* Thread */}
          <div ref={threadRef} role="log" aria-live="polite" aria-label="Chat messages" style={{
            flex: 1, padding: '8px 20px 16px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '14px',
            position: 'relative', zIndex: 1, scrollbarWidth: 'thin',
            overscrollBehavior: 'contain',
          }}>
            {state.messages.map(msg => <DarkMessageBubble key={msg.id} msg={msg} accent={accent} />)}
            {state.isTyping && <DarkTypingIndicator />}
          </div>

          {/* Suggested prompts */}
          {showChips && (
            <div style={{ padding: state.hasSentMessage ? '0 0 16px' : '0 20px 16px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
              {!state.hasSentMessage && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, marginBottom: '8px' }}>
                  Try asking
                </div>
              )}
              <div className={state.hasSentMessage ? 'sd-r-scrollable' : ''} style={{
                display: 'flex',
                flexDirection: state.hasSentMessage ? 'row' : 'column',
                gap: '6px',
                padding: state.hasSentMessage ? '0 20px' : 0
              }}>
                {chips.map(chip => (
                  <button key={chip} className="sd-r-prompt" onClick={() => { setInputValue(''); submit(chip); }} style={{
                    textAlign: 'left', padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: '13px',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background .12s',
                    width: state.hasSentMessage ? 'auto' : '100%',
                    whiteSpace: state.hasSentMessage ? 'nowrap' : 'normal',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <div style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${inputValue ? `color-mix(in oklab, ${accent} 60%, transparent)` : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '12px', padding: '4px 4px 4px 14px',
              transition: 'border-color .15s',
            }}>
              <input ref={inputRef} value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                className="sd-r-input"
                aria-label="Type your question"
                autoComplete="off"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', padding: '9px 0', fontFamily: 'inherit', color: '#fff' }}
              />
              <button className="sd-r-send" onClick={handleSubmit} aria-label="Send message" style={{
                width: 32, height: 32, borderRadius: 9, padding: 0, border: 'none', cursor: 'pointer',
                background: inputValue
                  ? `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #fff))`
                  : 'rgba(255,255,255,0.08)',
                color: inputValue ? '#fff' : 'rgba(255,255,255,0.4)',
                display: 'grid', placeItems: 'center', transition: 'background .15s',
                boxShadow: inputValue ? `0 4px 12px -2px color-mix(in oklab, ${accent} 60%, transparent)` : 'none',
              }}>
                <IconSend size={14} />
              </button>
            </div>
            {showPoweredBy && <div style={{ marginTop: '10px' }}><PoweredBy dark /></div>}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface SageDeskWidgetProps {
  /** Operating mode. 'local' (default) runs entirely in the browser via WASM. 'llm' posts to the consumer's own backend. */
  mode?: SageDeskMode;
  /** URL to the pre-built vector index. Required in local mode. */
  indexUrl?: string;
  /** Consumer's backend endpoint that accepts POST { query }. Required in llm mode. */
  endpoint?: string;
  agent: SageDeskConfig['agent'];
  search?: SageDeskConfig['search'];
}

export function SageDeskWidget({ mode, indexUrl, endpoint, agent, search }: SageDeskWidgetProps) {
  const resolvedMode = mode ?? 'local';

  if (!agent?.name) {
    throw new Error('[sagedesk] Required prop "agent.name" is missing.');
  }

  if (resolvedMode === 'local' && !indexUrl) {
    throw new Error(
      '[sagedesk] Required prop "indexUrl" is missing for local mode. ' +
      'Run `npx sagedesk build` and pass the output path, e.g. indexUrl="/support-index.json".'
    );
  }

  if (resolvedMode === 'llm' && !endpoint) {
    throw new Error(
      '[sagedesk] Required prop "endpoint" is missing for llm mode. ' +
      'Provide your backend route, e.g. endpoint="/api/sagedesk".'
    );
  }

  const config = useMemo<SageDeskConfig>(
    () => ({ mode: resolvedMode, indexUrl, endpoint, agent, search }),
    [resolvedMode, indexUrl, endpoint, agent, search]
  );
  const { state, chips, open, close, submit } = useSageDesk(config);

  const theme = agent.theme ?? 'classic';
  const accent = agent.accentColor ?? '#534AB7';
  const position = agent.position ?? 'bottom-right';
  const isLeft = position === 'bottom-left';

  const [inputValue, setInputValue] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (resolvedMode === 'local' && indexUrl &&
        !indexUrl.startsWith('/') && !indexUrl.startsWith('http')) {
      console.warn(
        `[sagedesk] indexUrl "${indexUrl}" looks like a relative path. ` +
        'It should start with "/" so it resolves correctly from any page.'
      );
    }
    setMounted(true);
    injectStyles(theme);
  }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [state.messages, state.isTyping]);

  useEffect(() => {
    if (state.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [state.isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      close();
      triggerRef.current?.focus();
    }, 150);
  }, [close]);

  const handleSubmit = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    submit(text);
  }, [inputValue, submit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!mounted || typeof document === 'undefined') return null;

  const showPoweredBy = true;
  const showChips = chips.length > 0;
  const panelClass = isClosing ? 'sd-r-closing' : state.isOpen ? 'sd-r-opening' : '';

  const props: ThemeRenderProps = {
    agent, state, chips, accent, isLeft, inputValue, setInputValue,
    handleClose, handleSubmit, handleKeyDown, isClosing, panelClass,
    showChips, showPoweredBy, threadRef, inputRef, triggerRef, open, submit,
  };

  const content =
    theme === 'dark' ? <DarkTheme {...props} /> :
      theme === 'light' ? <LightTheme {...props} /> :
        <ClassicTheme {...props} />;

  return createPortal(content, document.body);
}
