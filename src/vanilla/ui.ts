import type { Theme } from '../core/types.js';

// ─── Theme dispatch ───────────────────────────────────────────────────────────

export function getWidgetStyles(accent: string, theme: Theme = 'classic'): string {
  if (theme === 'light') return getLightStyles(accent);
  if (theme === 'dark')  return getDarkStyles(accent);
  return getClassicStyles(accent);
}

// ─── Classic ──────────────────────────────────────────────────────────────────
// Gradient header, distinguished bubbles with subtle shadow, quick-reply pills.

export function getClassicStyles(accent: string): string {
  return `
:host {
  display: block;
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  overflow: visible;
  font-family: inherit;
  --sd-accent: ${accent};
}

*, *::before, *::after { box-sizing: border-box; font-family: inherit; }

/* ─── Trigger ───────────────────────────────────────────────── */

.sd-trigger {
  position: fixed;
  bottom: 28px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${accent} 0%, color-mix(in oklab, ${accent} 78%, #1a1340) 100%);
  border: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  pointer-events: all;
  transition: transform 150ms ease;
  z-index: 9999;
  outline: none;
  padding: 0;
  color: #fff;
  box-shadow: 0 14px 28px -6px color-mix(in oklab, ${accent} 55%, transparent), 0 4px 10px rgba(40,30,90,0.15);
}
.sd-trigger:hover { transform: scale(1.06); }
.sd-trigger:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
.sd-trigger.pos-left { right: auto; left: 24px; }

/* ─── Panel ─────────────────────────────────────────────────── */

.sd-panel {
  position: fixed;
  bottom: 96px;
  right: 24px;
  width: 380px;
  height: 580px;
  max-height: 580px;
  border-radius: 20px;
  border: 1px solid rgba(20,20,40,0.04);
  background: #fff;
  box-shadow: 0 1px 0 rgba(20,20,40,0.04), 0 24px 48px -16px rgba(40,30,90,0.22), 0 4px 14px rgba(40,30,90,0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: all;
  z-index: 9999;
  transform-origin: bottom right;
}
.sd-panel.pos-left  { right: auto; left: 24px; transform-origin: bottom left; }
.sd-panel[data-open="true"]    { animation: sd-panel-open  200ms cubic-bezier(0.34,1.56,0.64,1) both; }
.sd-panel[data-closing="true"] { animation: sd-panel-close 150ms ease-in both; }
.sd-panel[data-open="false"]:not([data-closing="true"]) { display: none; }

@keyframes sd-panel-open  { from { transform: scale(0.94) translateY(6px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes sd-panel-close { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.94) translateY(6px); opacity: 0; } }

/* ─── Header ────────────────────────────────────────────────── */

.sd-header {
  padding: 18px 20px;
  background: linear-gradient(135deg, ${accent} 0%, color-mix(in oklab, ${accent} 78%, #1a1340) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  position: relative;
}

.sd-avatar-wrap { position: relative; width: 40px; height: 40px; flex-shrink: 0; }

.sd-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.18);
  display: grid;
  place-items: center;
  overflow: hidden;
}
.sd-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

.sd-online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 2.5px ${accent};
}

.sd-agent-info  { flex: 1; min-width: 0; }
.sd-agent-name  { font-size: 15px; font-weight: 600; color: #fff; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; padding: 0; letter-spacing: -0.01em; }
.sd-status      { font-size: 12px; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.sd-status-dot  { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(74,222,128,0.25); }

.sd-close {
  width: 30px; height: 30px;
  background: rgba(255,255,255,0.14);
  border: none; color: #fff; border-radius: 8px;
  cursor: pointer; display: grid; place-items: center;
  flex-shrink: 0; outline: none; padding: 0;
  transition: background 120ms;
}
.sd-close:hover { background: rgba(255,255,255,0.22); }
.sd-close:focus-visible { outline: 2px solid rgba(255,255,255,0.6); }

/* ─── Thread ────────────────────────────────────────────────── */

.sd-thread {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 22px 18px 18px;
  background: #fbfbfa;
  min-height: 280px;
  display: flex; flex-direction: column; gap: 18px;
  scrollbar-width: thin; scrollbar-color: rgba(20,20,40,0.12) transparent;
  overscroll-behavior: contain;
}
.sd-thread::-webkit-scrollbar { width: 4px; }
.sd-thread::-webkit-scrollbar-track { background: transparent; }
.sd-thread::-webkit-scrollbar-thumb { background: rgba(20,20,40,0.12); border-radius: 2px; }

/* ─── Messages ──────────────────────────────────────────────── */

.sd-msg-wrap { display: flex; flex-direction: column; }
.sd-msg-wrap.bot  { align-items: flex-start; }
.sd-msg-wrap.user { align-items: flex-end; }

.sd-fallback-label { font-size: 11px; font-weight: 500; color: #9b9aa3; margin: 0 0 4px; padding: 0 4px; }

.sd-bubble {
  max-width: 82%; padding: 10px 14px;
  font-size: 14px; line-height: 1.5;
  word-break: break-word; white-space: pre-wrap;
}
.sd-bubble.bot {
  background: #fff;
  border: 1px solid rgba(20,20,40,0.06);
  border-radius: 16px 16px 16px 6px;
  color: #1a1a2e;
  box-shadow: 0 1px 2px rgba(20,20,40,0.04);
}
.sd-bubble.user {
  background: ${accent};
  color: #fff;
  border-radius: 16px 16px 6px 16px;
  box-shadow: 0 6px 16px -6px color-mix(in oklab, ${accent} 60%, transparent);
}

.sd-timestamp { font-size: 11px; color: #a8a8b0; padding: 0 4px; margin-top: 4px; font-variant-numeric: tabular-nums; }
.sd-msg-wrap.user .sd-timestamp { padding: 0 4px 0 0; }
.sd-msg-wrap.bot  .sd-timestamp { padding: 0 0 0 4px; }

/* ─── Typing indicator ──────────────────────────────────────── */

.sd-typing {
  display: flex; align-items: center; gap: 4px;
  padding: 10px 14px;
  background: #fff; border: 1px solid rgba(20,20,40,0.06);
  border-radius: 16px 16px 16px 6px;
  box-shadow: 0 1px 2px rgba(20,20,40,0.04);
  align-self: flex-start;
}
.sd-dot { width: 6px; height: 6px; border-radius: 50%; background: #c8c8ce; animation: sd-bounce 1.2s ease-in-out infinite; }
.sd-dot:nth-child(2) { animation-delay: 0.2s; }
.sd-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes sd-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

/* ─── Chips ─────────────────────────────────────────────────── */

.sd-chips { padding: 0 18px 16px; background: #fbfbfa; flex-shrink: 0; }
.sd-chips.scrollable { padding: 0 0 16px; }
.sd-chips-label { font-size: 11px; color: #9b9aa3; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; padding-left: 4px; margin-bottom: 6px; }
.sd-chips.scrollable .sd-chips-label { padding-left: 18px; }
.sd-chips-row   { display: flex; flex-wrap: wrap; gap: 6px; }
.sd-chips.scrollable .sd-chips-row {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 0 18px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sd-chips.scrollable .sd-chips-row::-webkit-scrollbar { display: none; }
.sd-chips.scrollable .sd-chip { flex-shrink: 0; }

.sd-chip {
  font-size: 12.5px; padding: 7px 12px; border-radius: 999px;
  background: #fff; border: 1px solid color-mix(in oklab, ${accent} 24%, transparent);
  color: ${accent}; cursor: pointer; font-weight: 500; letter-spacing: -0.005em;
  outline: none; transition: opacity 100ms;
}
.sd-chip:hover { opacity: 0.8; }
.sd-chip:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Composer ──────────────────────────────────────────────── */

.sd-composer { padding: 14px 14px 16px; border-top: 1px solid rgba(20,20,40,0.06); background: #fff; flex-shrink: 0; }

.sd-input-wrap {
  display: flex; align-items: center; gap: 6px;
  background: #f5f4f0; border-radius: 12px; padding: 5px 6px 5px 14px;
  border: 1px solid transparent; transition: border-color .15s, box-shadow .15s;
}
.sd-input-wrap:focus-within {
  border-color: color-mix(in oklab, ${accent} 30%, transparent);
  box-shadow: 0 0 0 4px color-mix(in oklab, ${accent} 12%, transparent);
}

.sd-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; padding: 8px 0; color: #1a1a2e; min-width: 0; }
.sd-input::placeholder { color: #a8a8b0; }

.sd-send {
  width: 32px; height: 32px; border-radius: 8px;
  background: color-mix(in oklab, ${accent} 22%, #e5e3dc);
  border: none; color: #fff; cursor: pointer; display: grid; place-items: center;
  flex-shrink: 0; padding: 0; outline: none; transition: background .15s, opacity .1s, transform .1s;
}
.sd-send.active { background: ${accent}; }
.sd-send:hover  { opacity: 0.85; }
.sd-send:active { transform: scale(0.95); }
.sd-send:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Footer ─────────────────────────────────────────────────── */

.sd-footer {
  height: 34px; background: #fff; border-top: 1px solid rgba(20,20,40,0.04);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: #a8a8b0; gap: 5px; flex-shrink: 0;
}
.sd-footer[hidden] { display: none; }
.sd-footer-link { color: #5a5a64; font-weight: 500; text-decoration: none; }
.sd-footer-link:hover { text-decoration: underline; }

/* ─── Mobile ─────────────────────────────────────────────────── */

@media (max-width: 420px) {
  .sd-panel {
    bottom: 0; right: 0; left: 0; width: auto; max-width: 100%;
    height: auto; max-height: 85vh;
    border-radius: 20px 20px 0 0;
    transform-origin: bottom center;
  }
  .sd-panel.pos-left { right: 0; transform-origin: bottom center; }
}
`;
}

// ─── Light (Editorial) ────────────────────────────────────────────────────────
// Warm white, content-led. Avatar with gradient, text-style bot messages,
// accent-tinted user bubbles.

export function getLightStyles(accent: string): string {
  return `
:host {
  display: block; position: fixed; inset: 0;
  z-index: 9999; pointer-events: none; overflow: visible; font-family: inherit;
  --sd-accent: ${accent};
}
*, *::before, *::after { box-sizing: border-box; font-family: inherit; }

/* ─── Trigger (pill) ────────────────────────────────────────── */

.sd-trigger {
  position: fixed; bottom: 28px; right: 24px;
  height: 52px; padding: 0 8px 0 20px; border-radius: 999px;
  background: #fdfcf9; border: 1px solid rgba(20,20,40,0.08);
  cursor: pointer; display: flex; align-items: center; gap: 14px;
  pointer-events: all; z-index: 9999; font-family: inherit;
  box-shadow: 0 12px 26px -8px rgba(40,30,90,0.18), 0 2px 8px rgba(40,30,90,0.06);
  transition: box-shadow 150ms ease; outline: none;
}
.sd-trigger:hover { box-shadow: 0 16px 32px -10px rgba(40,30,90,0.24), 0 2px 10px rgba(40,30,90,0.08); }
.sd-trigger:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
.sd-trigger.pos-left { right: auto; left: 24px; }

.sd-trigger-label { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
.sd-trigger-label-main { font-size: 14px; font-weight: 600; color: #1a1a2e; }
.sd-trigger-label-sub  { font-size: 11px; color: #9b9aa3; margin-top: 2px; }

.sd-trigger-circle {
  width: 36px; height: 36px; border-radius: 50%;
  background: ${accent}; color: #fff;
  display: grid; place-items: center; flex-shrink: 0;
}

/* ─── Panel ─────────────────────────────────────────────────── */

.sd-panel {
  position: fixed; bottom: 92px; right: 24px;
  width: 400px; height: 580px; max-height: 580px; border-radius: 22px;
  border: 1px solid rgba(20,20,40,0.05);
  background: #fdfcf9;
  box-shadow: 0 1px 0 rgba(20,20,40,0.04), 0 30px 60px -20px rgba(40,30,90,0.18), 0 6px 16px rgba(40,30,90,0.06);
  overflow: hidden; display: flex; flex-direction: column;
  pointer-events: all; z-index: 9999; transform-origin: bottom right;
}
.sd-panel.pos-left  { right: auto; left: 24px; transform-origin: bottom left; }
.sd-panel[data-open="true"]    { animation: sd-panel-open  200ms cubic-bezier(0.34,1.56,0.64,1) both; }
.sd-panel[data-closing="true"] { animation: sd-panel-close 150ms ease-in both; }
.sd-panel[data-open="false"]:not([data-closing="true"]) { display: none; }
@keyframes sd-panel-open  { from { transform: scale(0.94) translateY(6px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes sd-panel-close { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.94) translateY(6px); opacity: 0; } }

/* ─── Header ────────────────────────────────────────────────── */

.sd-header {
  padding: 18px 20px 14px; background: #fdfcf9;
  border-bottom: 1px solid rgba(20,20,40,0.05);
  display: flex; align-items: center; gap: 12px; flex-shrink: 0;
}
.sd-avatar-wrap { width: 36px; height: 36px; flex-shrink: 0; }
.sd-avatar {
  width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
  background: linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, #fff));
  display: grid; place-items: center; color: #fff;
}
.sd-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.sd-agent-info  { flex: 1; min-width: 0; }
.sd-agent-name  { font-size: 14.5px; font-weight: 600; color: #1a1a2e; letter-spacing: -0.01em; margin: 0; padding: 0; }
.sd-status      { font-size: 12px; color: #7a7a82; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.sd-status-dot  { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
.sd-close {
  width: 30px; height: 30px; background: transparent; border: none;
  color: #9b9aa3; border-radius: 8px; cursor: pointer;
  display: grid; place-items: center; padding: 0; outline: none;
}
.sd-close:hover { color: #5a5a64; }
.sd-close:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Thread ────────────────────────────────────────────────── */

.sd-thread {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 22px 20px 16px; min-height: 280px;
  display: flex; flex-direction: column; gap: 22px;
  scrollbar-width: thin; scrollbar-color: rgba(20,20,40,0.1) transparent;
  overscroll-behavior: contain;
}
.sd-thread::-webkit-scrollbar { width: 4px; }
.sd-thread::-webkit-scrollbar-thumb { background: rgba(20,20,40,0.1); border-radius: 2px; }

/* ─── Messages ──────────────────────────────────────────────── */

.sd-msg-wrap { display: flex; flex-direction: column; }
.sd-msg-wrap.bot  { align-items: flex-start; flex-direction: row; gap: 10px; }
.sd-msg-wrap.user { align-items: flex-end; }

/* Bot: avatar + text column */
.sd-bot-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
  background: linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #fff));
}
.sd-bot-body { flex: 1; min-width: 0; }
.sd-bot-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.sd-bot-name { font-size: 13px; font-weight: 600; color: #1a1a2e; }
.sd-timestamp { font-size: 11px; color: #a8a89e; font-variant-numeric: tabular-nums; }

.sd-fallback-label { font-size: 11px; color: #9b9aa3; margin: 0 0 4px; }

.sd-bubble { word-break: break-word; white-space: pre-wrap; }
.sd-bubble.bot  { font-size: 14px; line-height: 1.55; color: #2a2a36; }
.sd-bubble.user {
  max-width: 78%; padding: 11px 15px; font-size: 14px; line-height: 1.5;
  border-radius: 16px 16px 4px 16px;
  background: color-mix(in oklab, ${accent} 10%, white);
  color: ${accent};
  border: 1px solid color-mix(in oklab, ${accent} 22%, transparent);
  font-weight: 500;
}

/* ─── Typing indicator ──────────────────────────────────────── */

.sd-typing {
  display: flex; align-items: flex-start; gap: 10px;
}
.sd-typing-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
  background: linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #fff));
}
.sd-typing-dots {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 10px 14px; border-radius: 16px 16px 16px 4px;
  background: #fff; border: 1px solid rgba(20,20,40,0.07);
  box-shadow: 0 1px 2px rgba(20,20,40,0.04);
}
.sd-dot { width: 6px; height: 6px; border-radius: 50%; background: #c4c4be; animation: sd-bounce 1.2s ease-in-out infinite; }
.sd-dot:nth-child(2) { animation-delay: 0.2s; }
.sd-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes sd-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

/* ─── Chips ─────────────────────────────────────────────────── */

.sd-chips { padding: 0 20px 14px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
.sd-chips.scrollable {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sd-chips.scrollable::-webkit-scrollbar { display: none; }
.sd-chips.scrollable .sd-chip { flex-shrink: 0; }

.sd-chip {
  font-size: 12px; padding: 5px 10px; border-radius: 6px;
  background: #f4f3ee; border: none; color: #5a5a64;
  cursor: pointer; font-weight: 500; outline: none; transition: opacity 100ms;
}
.sd-chip:hover { opacity: 0.75; }
.sd-chip:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Composer ──────────────────────────────────────────────── */

.sd-composer { padding: 14px; border-top: 1px solid rgba(20,20,40,0.05); background: #fdfcf9; flex-shrink: 0; }
.sd-input-wrap {
  background: #fff; border-radius: 14px; padding: 10px 12px;
  border: 1px solid rgba(20,20,40,0.1); transition: border-color .15s, box-shadow .15s;
}
.sd-input-wrap:focus-within {
  border-color: color-mix(in oklab, ${accent} 40%, transparent);
  box-shadow: 0 0 0 4px color-mix(in oklab, ${accent} 12%, transparent);
}
.sd-input { width: 100%; background: transparent; border: none; outline: none; font-size: 14px; color: #1a1a2e; display: block; }
.sd-input::placeholder { color: #a8a89e; }
.sd-input-actions { display: flex; align-items: center; margin-top: 8px; }
.sd-send {
  width: 28px; height: 28px; border-radius: 7px; margin-left: auto;
  background: #e8e7e0; border: none; color: #a8a89e;
  cursor: pointer; display: grid; place-items: center; padding: 0; outline: none;
  transition: background .15s, color .15s, opacity .1s, transform .1s;
}
.sd-send.active { background: ${accent}; color: #fff; }
.sd-send:hover  { opacity: 0.85; }
.sd-send:active { transform: scale(0.95); }
.sd-send:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Footer ─────────────────────────────────────────────────── */

.sd-footer {
  height: 34px; background: #fdfcf9; border-top: 1px solid rgba(20,20,40,0.04);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: #a8a89e; gap: 5px; flex-shrink: 0;
}
.sd-footer[hidden] { display: none; }
.sd-footer-link { color: #5a5a64; font-weight: 500; text-decoration: none; }
.sd-footer-link:hover { text-decoration: underline; }

@media (max-width: 420px) {
  .sd-panel { bottom: 0; right: 0; left: 0; width: auto; max-width: 100%; height: auto; max-height: 85vh; border-radius: 22px 22px 0 0; transform-origin: bottom center; }
  .sd-panel.pos-left { right: 0; transform-origin: bottom center; }
}
`;
}

// ─── Dark (Glass) ─────────────────────────────────────────────────────────────
// Frosted dark surface with ambient accent glow, gradient user bubbles,
// sparkle icon header, "Try asking" prompts.

export function getDarkStyles(accent: string): string {
  return `
:host {
  display: block; position: fixed; inset: 0;
  z-index: 9999; pointer-events: none; overflow: visible; font-family: inherit;
  --sd-accent: ${accent};
}
*, *::before, *::after { box-sizing: border-box; font-family: inherit; }

/* ─── Launcher glow ─────────────────────────────────────────── */

.sd-trigger-glow {
  position: fixed; bottom: 18px; right: 18px;
  width: 80px; height: 80px; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in oklab, ${accent} 50%, transparent), transparent 70%);
  filter: blur(10px); pointer-events: none; z-index: 9998;
}
.sd-trigger-glow.pos-left { right: auto; left: 18px; }

/* ─── Trigger ───────────────────────────────────────────────── */

.sd-trigger {
  position: fixed; bottom: 28px; right: 24px;
  width: 60px; height: 60px; border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in oklab, ${accent} 70%, #1a1340), #1a1a2e);
  border: 1px solid rgba(255,255,255,0.12); color: #fff;
  cursor: pointer; display: grid; place-items: center;
  pointer-events: all; z-index: 9999; padding: 0;
  transition: transform 150ms ease; outline: none;
  box-shadow: 0 16px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
}
.sd-trigger:hover { transform: scale(1.04); }
.sd-trigger:focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
.sd-trigger.pos-left { right: auto; left: 24px; }

/* ─── Panel ─────────────────────────────────────────────────── */

.sd-panel {
  position: fixed; bottom: 100px; right: 24px;
  width: 380px; height: 580px; max-height: 580px; border-radius: 22px;
  background: rgba(18, 16, 32, 0.86);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  box-shadow: 0 30px 60px -20px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden; display: flex; flex-direction: column;
  pointer-events: all; z-index: 9999; color: #fff;
  transform-origin: bottom right;
}
.sd-panel.pos-left  { right: auto; left: 24px; transform-origin: bottom left; }
.sd-panel[data-open="true"]    { animation: sd-panel-open  200ms cubic-bezier(0.34,1.56,0.64,1) both; }
.sd-panel[data-closing="true"] { animation: sd-panel-close 150ms ease-in both; }
.sd-panel[data-open="false"]:not([data-closing="true"]) { display: none; }
@keyframes sd-panel-open  { from { transform: scale(0.94) translateY(6px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
@keyframes sd-panel-close { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.94) translateY(6px); opacity: 0; } }

/* ─── Panel top-glow overlay ────────────────────────────────── */

.sd-panel-glow {
  position: absolute; top: 0; left: 0; right: 0; height: 200px; pointer-events: none;
  background: radial-gradient(ellipse 80% 100% at 50% 0%, color-mix(in oklab, ${accent} 40%, transparent) 0%, transparent 70%);
}

/* ─── Header ────────────────────────────────────────────────── */

.sd-header {
  padding: 20px 20px 16px; display: flex; align-items: center; gap: 12px;
  position: relative; z-index: 1; flex-shrink: 0;
}
.sd-avatar-wrap { position: relative; flex-shrink: 0; }
.sd-avatar {
  width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; overflow: hidden;
  background: linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 50%, #fff));
  box-shadow: 0 0 24px color-mix(in oklab, ${accent} 50%, transparent);
}
.sd-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.sd-online-dot {
  position: absolute; right: -2px; bottom: -2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: #22c55e; box-shadow: 0 0 0 2.5px rgba(18,16,32,1);
}
.sd-agent-info  { flex: 1; }
.sd-agent-name  { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; margin: 0; padding: 0; }
.sd-status      { font-size: 12px; color: rgba(255,255,255,0.55); display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.sd-status-dot  { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; flex-shrink: 0; }
.sd-close {
  width: 30px; height: 30px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7); border-radius: 8px;
  cursor: pointer; display: grid; place-items: center; padding: 0; outline: none;
}
.sd-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
.sd-close:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Thread ────────────────────────────────────────────────── */

.sd-thread {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 8px 20px 16px; min-height: 280px;
  display: flex; flex-direction: column; gap: 14px;
  position: relative; z-index: 1;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
  overscroll-behavior: contain;
}
.sd-thread::-webkit-scrollbar { width: 4px; }
.sd-thread::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* ─── Messages ──────────────────────────────────────────────── */

.sd-msg-wrap { display: flex; flex-direction: column; }
.sd-msg-wrap.bot  { align-items: flex-start; }
.sd-msg-wrap.user { align-items: flex-end; }

.sd-fallback-label { font-size: 11px; color: rgba(255,255,255,0.5); margin: 0 0 4px; }

.sd-bubble { max-width: 85%; padding: 12px 14px; font-size: 14px; word-break: break-word; white-space: pre-wrap; }
.sd-bubble.bot {
  line-height: 1.6; border-radius: 14px 14px 14px 6px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.92);
}
.sd-bubble.user {
  line-height: 1.5; border-radius: 14px 14px 6px 14px;
  background: linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 75%, #1a1340));
  color: #fff;
  box-shadow: 0 8px 20px -8px color-mix(in oklab, ${accent} 70%, transparent);
}

.sd-timestamp { font-size: 11px; color: rgba(255,255,255,0.3); padding: 0 4px; margin-top: 4px; font-variant-numeric: tabular-nums; }

/* ─── Typing indicator ──────────────────────────────────────── */

.sd-typing {
  max-width: 85%; padding: 12px 14px;
  border-radius: 14px 14px 14px 6px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; gap: 4px; align-self: flex-start;
}
.sd-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); animation: sd-bounce 1.2s ease-in-out infinite; }
.sd-dot:nth-child(2) { animation-delay: 0.2s; }
.sd-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes sd-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

/* ─── "Try asking" chips ────────────────────────────────────── */

.sd-chips { padding: 0 20px 16px; position: relative; z-index: 1; flex-shrink: 0; }
.sd-chips.scrollable {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sd-chips.scrollable::-webkit-scrollbar { display: none; }
.sd-chips.scrollable .sd-chips-label { display: none; }
.sd-chips.scrollable .sd-chip { flex-shrink: 0; margin-bottom: 0; width: auto; white-space: nowrap; }

.sd-chips-label { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; margin-bottom: 8px; }
.sd-chip {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left; padding: 10px 14px; border-radius: 10px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.85); cursor: pointer; font-size: 13px;
  margin-bottom: 6px; outline: none; transition: background .12s;
}
.sd-chip:last-child { margin-bottom: 0; }
.sd-chip:hover { background: rgba(255,255,255,0.07); }
.sd-chip:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Composer ──────────────────────────────────────────────── */

.sd-composer {
  padding: 14px; border-top: 1px solid rgba(255,255,255,0.06);
  position: relative; z-index: 1; flex-shrink: 0;
}
.sd-input-wrap {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 4px 4px 4px 14px;
  transition: border-color .15s;
}
.sd-input-wrap:focus-within { border-color: color-mix(in oklab, ${accent} 60%, transparent); }
.sd-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; padding: 9px 0; color: #fff; min-width: 0; }
.sd-input::placeholder { color: rgba(255,255,255,0.35); }
.sd-send {
  width: 32px; height: 32px; border-radius: 9px; border: none; padding: 0;
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4);
  cursor: pointer; display: grid; place-items: center; flex-shrink: 0;
  transition: background .15s, color .15s, box-shadow .15s, opacity .1s, transform .1s; outline: none;
}
.sd-send.active {
  background: linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 60%, #fff));
  color: #fff;
  box-shadow: 0 4px 12px -2px color-mix(in oklab, ${accent} 60%, transparent);
}
.sd-send:hover  { opacity: 0.85; }
.sd-send:active { transform: scale(0.95); }
.sd-send:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }

/* ─── Footer ─────────────────────────────────────────────────── */

.sd-footer {
  height: 34px; border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: rgba(255,255,255,0.35); gap: 5px; flex-shrink: 0;
  position: relative; z-index: 1;
}
.sd-footer[hidden] { display: none; }
.sd-footer-link { color: rgba(255,255,255,0.7); font-weight: 500; text-decoration: none; }
.sd-footer-link:hover { text-decoration: underline; }

@media (max-width: 420px) {
  .sd-panel { bottom: 0; right: 0; left: 0; width: auto; max-width: 100%; height: auto; max-height: 85vh; border-radius: 22px 22px 0 0; transform-origin: bottom center; }
  .sd-panel.pos-left { right: 0; transform-origin: bottom center; }
}
`;
}

// ── SVG icons ──────────────────────────────────────────────────────────────────

export const ICON_CHAT = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7A2.5 2.5 0 0116.5 16H11l-4 3.5V16H7.5A2.5 2.5 0 015 13.5v-7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const ICON_CHAT_SM = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7A2.5 2.5 0 0116.5 16H11l-4 3.5V16H7.5A2.5 2.5 0 015 13.5v-7z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const ICON_PERSON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12.5a4 4 0 100-8 4 4 0 000 8z"/><path d="M5 20.5c0-3.5 3.13-6 7-6s7 2.5 7 6"/></svg>`;

export const ICON_SEND = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12L20 4l-4 16-4-7-8-1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

export const ICON_SPARKLE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.6 4.8L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.2L12 3z" fill="currentColor"/></svg>`;

export const ICON_SPARKLE_LG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.6 4.8L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.2L12 3z" fill="currentColor"/></svg>`;

export const ICON_BOT = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="13.5" r="1.5" fill="currentColor"/><circle cx="15" cy="13.5" r="1.5" fill="currentColor"/><path d="M9.5 16.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 8V5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="4" r="1.2" fill="currentColor"/></svg>`;

export const ICON_BOT_SM = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="13.5" r="1.5" fill="currentColor"/><circle cx="15" cy="13.5" r="1.5" fill="currentColor"/><path d="M9.5 16.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 8V5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="4" r="1.2" fill="currentColor"/></svg>`;

export const ICON_CHEVRON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
