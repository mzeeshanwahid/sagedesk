import { getWidgetStyles, ICON_CHAT, ICON_CHAT_SM, ICON_PERSON, ICON_SEND, ICON_CLOSE, ICON_BOT, ICON_BOT_SM, ICON_CHEVRON } from './ui.js';
import { EmbedderRuntime } from '../core/embedder.js';
import { fetchIndex, retrieve } from '../core/retriever.js';
import { buildAnswer, extractChips } from '../core/renderer.js';
import { getFallback } from '../core/fallback.js';
import type { SageDeskConfig, IndexChunk, ChatMessage, Theme } from '../core/types.js';

export class SageDeskWidget extends HTMLElement {
  private _config!: SageDeskConfig;
  private _shadow!: ShadowRoot;
  private _index: IndexChunk[] | null = null;
  private _embedder: EmbedderRuntime | null = null;
  private _messages: ChatMessage[] = [];
  private _isOpen = false;
  private _isTyping = false;
  private _engineReady = false;
  private _engineError: string | null = null;
  private _msgCounter = 0;
  private _hasSentMessage = false;

  static get observedAttributes() {
    return ['config'];
  }

  init(config: SageDeskConfig): void {
    this._config = config;
    this._mount();
  }

  private get _theme(): Theme {
    return this._config.agent.theme ?? 'classic';
  }

  private _mount(): void {
    const accent   = this._config.agent.accentColor ?? '#534AB7';
    const position = this._config.agent.position ?? 'bottom-right';
    const theme    = this._theme;

    this._shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getWidgetStyles(accent, theme);
    this._shadow.appendChild(style);

    this._buildDOM(accent, position, theme);
    this._bindEvents();
  }

  private _buildDOM(accent: string, position: string, theme: Theme): void {
    const posClass   = position === 'bottom-left' ? 'pos-left' : '';
    const agentName  = this._config.agent.name ?? 'Support';

    // Dark theme: ambient glow div behind trigger
    if (theme === 'dark') {
      const glow = document.createElement('div');
      glow.className = `sd-trigger-glow${posClass ? ' ' + posClass : ''}`;
      this._shadow.appendChild(glow);
    }

    // Trigger button
    const trigger = document.createElement('button');
    trigger.className = `sd-trigger${posClass ? ' ' + posClass : ''}`;
    trigger.setAttribute('aria-label', 'Open support chat');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = theme === 'dark' ? ICON_BOT : ICON_CHAT;
    this._shadow.appendChild(trigger);

    // Panel
    const panel = document.createElement('div');
    panel.className = `sd-panel${posClass ? ' ' + posClass : ''}`;
    panel.setAttribute('data-open', 'false');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', agentName);
    panel.innerHTML = this._buildPanelHTML(agentName, accent, theme);
    this._shadow.appendChild(panel);
  }

  private _buildPanelHTML(agentName: string, accent: string, theme: Theme): string {
    const avatarUrl     = this._config.agent.avatarUrl;
    const footerHTML    = `<div class="sd-footer">Powered by <a class="sd-footer-link" href="https://github.com/mzeeshanwahid/sagedesk" target="_blank" rel="noopener">sagedesk</a></div>`;

    if (theme === 'dark') {
      const avatarContent = avatarUrl
        ? `<img class="sd-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}">`
        : ICON_BOT_SM;
      return `
        <div class="sd-panel-glow" aria-hidden="true"></div>
        <div class="sd-header">
          <div class="sd-avatar-wrap">
            <div class="sd-avatar">${avatarContent}</div>
            <span class="sd-online-dot"></span>
          </div>
          <div class="sd-agent-info">
            <p class="sd-agent-name">${escapeHtml(agentName)}</p>
            <div class="sd-status">
              <span class="sd-status-dot"></span>
              <span>Trained on this site · always on</span>
            </div>
          </div>
          <button class="sd-close" aria-label="Close chat">${ICON_CLOSE}</button>
        </div>
        <div class="sd-thread" role="log" aria-live="polite" aria-label="Chat messages"></div>
        <div class="sd-chips"></div>
        <div class="sd-composer">
          <div class="sd-input-wrap">
            <input class="sd-input" type="text" placeholder="Write a message…" aria-label="Type your question" autocomplete="off" />
            <button class="sd-send" aria-label="Send message">${ICON_SEND}</button>
          </div>
        </div>
        ${footerHTML}
      `;
    }

    if (theme === 'light') {
      const avatarContent = avatarUrl
        ? `<img class="sd-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}">`
        : ICON_PERSON;
      return `
        <div class="sd-header">
          <div class="sd-avatar-wrap">
            <div class="sd-avatar">${avatarContent}</div>
          </div>
          <div class="sd-agent-info">
            <p class="sd-agent-name">${escapeHtml(agentName)}</p>
            <div class="sd-status">
              <span class="sd-status-dot"></span>
              <span>Online · replies in under a minute</span>
            </div>
          </div>
          <button class="sd-close" aria-label="Close chat">${ICON_CLOSE}</button>
        </div>
        <div class="sd-trigger-label" hidden>
          <div class="sd-trigger-label-main">Chat with us</div>
          <div class="sd-trigger-label-sub">We typically reply in 1m</div>
        </div>
        <div class="sd-thread" role="log" aria-live="polite" aria-label="Chat messages"></div>
        <div class="sd-chips"></div>
        <div class="sd-composer">
          <div class="sd-input-wrap">
            <input class="sd-input" type="text" placeholder="Write a message…" aria-label="Type your question" autocomplete="off" />
            <div class="sd-input-actions">
              <button class="sd-send" aria-label="Send message">${ICON_SEND}</button>
            </div>
          </div>
        </div>
        ${footerHTML}
      `;
    }

    // Classic (default)
    const avatarContent = avatarUrl
      ? `<img class="sd-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}">`
      : ICON_PERSON;
    return `
      <div class="sd-header">
        <div class="sd-avatar-wrap">
          <div class="sd-avatar">${avatarContent}</div>
          <span class="sd-online-dot"></span>
        </div>
        <div class="sd-agent-info">
          <p class="sd-agent-name">${escapeHtml(agentName)}</p>
          <div class="sd-status">
            <span class="sd-status-dot"></span>
            <span>Typically replies in under a minute</span>
          </div>
        </div>
        <button class="sd-close" aria-label="Close chat">${ICON_CLOSE}</button>
      </div>
      <div class="sd-thread" role="log" aria-live="polite" aria-label="Chat messages"></div>
      <div class="sd-chips"></div>
      <div class="sd-composer">
        <div class="sd-input-wrap">
          <input class="sd-input" type="text" placeholder="Write a message…" aria-label="Type your question" autocomplete="off" />
          <button class="sd-send" aria-label="Send message">${ICON_SEND}</button>
        </div>
      </div>
      ${footerHTML}
    `;
  }

  private _buildTriggerHTML(theme: Theme): string {
    if (theme === 'light') {
      return `
        <span class="sd-trigger-label">
          <span class="sd-trigger-label-main">Chat with us</span>
          <span class="sd-trigger-label-sub">We typically reply in 1m</span>
        </span>
        <span class="sd-trigger-circle">${ICON_CHAT_SM}</span>
      `;
    }
    if (theme === 'dark') return ICON_BOT;
    return ICON_CHAT;
  }

  private _bindEvents(): void {
    const shadow = this._shadow;

    const trigger  = shadow.querySelector('.sd-trigger')  as HTMLButtonElement;
    const closeBtn = shadow.querySelector('.sd-close')     as HTMLButtonElement;
    const input    = shadow.querySelector('.sd-input')     as HTMLInputElement;
    const sendBtn  = shadow.querySelector('.sd-send')      as HTMLButtonElement;
    const panel    = shadow.querySelector('.sd-panel')     as HTMLElement;

    // Re-render trigger inner for light theme (pill needs label+circle)
    if (this._theme === 'light') {
      trigger.innerHTML = this._buildTriggerHTML('light');
    }

    trigger.addEventListener('click', () => {
      if (this._isOpen) {
        this._close();
      } else {
        this._open();
      }
    });
    closeBtn.addEventListener('click', () => this._close());
    sendBtn.addEventListener('click', () => this._submit());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submit(); }
    });

    // Update send button active state as user types
    input.addEventListener('input', () => {
      sendBtn.classList.toggle('active', input.value.trim().length > 0);
    });

    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._close();
    });

    // Focus trap
    panel.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first  = focusable[0];
      const last   = focusable[focusable.length - 1];
      const active = shadow.activeElement;
      if (e.shiftKey) {
        if (active === first) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  private async _open(): Promise<void> {
    if (this._isOpen) return;
    this._isOpen = true;

    const trigger = this._shadow.querySelector('.sd-trigger') as HTMLButtonElement;
    const panel   = this._shadow.querySelector('.sd-panel')   as HTMLElement;

    trigger.setAttribute('aria-expanded', 'true');
    panel.setAttribute('data-open', 'true');
    panel.removeAttribute('data-closing');

    if (this._messages.length === 0) {
      const greeting = this._config.agent.greeting ?? 'Hey, how can I help you today?';
      this._appendMessage({ role: 'bot', text: greeting });
    }

    this._renderChips();

    const input = this._shadow.querySelector('.sd-input') as HTMLInputElement;
    setTimeout(() => input.focus(), 50);

    if (!this._engineReady && !this._engineError) {
      this._startEngine();
    }
  }

  private _close(): void {
    if (!this._isOpen) return;

    const trigger = this._shadow.querySelector('.sd-trigger') as HTMLButtonElement;
    const panel   = this._shadow.querySelector('.sd-panel')   as HTMLElement;

    panel.setAttribute('data-closing', 'true');
    panel.addEventListener(
      'animationend',
      () => {
        this._isOpen = false;
        panel.setAttribute('data-open', 'false');
        panel.removeAttribute('data-closing');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      },
      { once: true }
    );
  }

  private async _startEngine(): Promise<void> {
    if (!this._config.indexUrl) {
      this._engineError = 'indexUrl is required for the vanilla widget (local mode only).';
      console.warn('[sagedesk] indexUrl is required. Run `npx sagedesk build` and pass indexUrl.');
      return;
    }
    try {
      this._index = await fetchIndex(this._config.indexUrl);
    } catch {
      this._engineError = 'Could not load knowledge base.';
      this._appendMessage({
        role: 'bot',
        text: "I'm having trouble loading right now. Please try again in a moment.",
      });
      return;
    }

    try {
      this._embedder = new EmbedderRuntime();
      await this._embedder.load(this._config.agent.model);
      this._engineReady = true;
    } catch {
      this._embedder = new EmbedderRuntime();
      this._engineReady = true;
    }
  }

  private async _submit(): Promise<void> {
    const input = this._shadow.querySelector('.sd-input') as HTMLInputElement;
    const text  = input.value.trim();
    if (!text) return;

    const typingStart  = Date.now();

    input.value = '';
    const sendBtn = this._shadow.querySelector('.sd-send') as HTMLButtonElement;
    sendBtn.classList.remove('active');

    this._hasSentMessage = true;
    this._appendMessage({ role: 'user', text });
    this._showTyping();

    if (!this._engineReady && !this._engineError) {
      await this._waitForEngine();
    }

    let botText: string;
    let isFallback = false;
    let mode: 'vector' | 'keyword' = 'keyword';

    if (this._engineError || !this._index) {
      botText    = getFallback(this._config.agent);
      isFallback = true;
    } else {
      try {
        const res = await retrieve(text, this._index, this._embedder!, this._config.search);
        mode = res.mode;
        if (res.results.length > 0) {
          botText = buildAnswer(res.results);
        } else {
          botText    = getFallback(this._config.agent);
          isFallback = true;
        }
      } catch {
        botText    = getFallback(this._config.agent);
        isFallback = true;
      }
    }

    const elapsed   = Date.now() - typingStart;
    // Artificial "thinking" delay: 3-5s in normal mode, 800ms-2.8s in degraded/fallback mode.
    const delayBase = (mode === 'keyword' || isFallback) ? 800 : 3000;
    const minTypingMsActual = delayBase + Math.random() * 2000;
    const remaining = minTypingMsActual - elapsed;
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

    this._hideTyping();
    this._appendMessage({ role: 'bot', text: botText, isFallback });
  }

  private _waitForEngine(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this._engineReady || this._engineError) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  private _appendMessage(msg: Pick<ChatMessage, 'role' | 'text' | 'isFallback'>): void {
    const thread = this._shadow.querySelector('.sd-thread') as HTMLElement;
    const theme  = this._theme;
    const id     = `msg-${++this._msgCounter}`;

    this._messages.push({
      id,
      role: msg.role,
      text: msg.text,
      isFallback: msg.isFallback,
      timestamp: new Date(),
    });

    const wrap = document.createElement('div');
    wrap.id    = id;

    if (theme === 'light' && msg.role === 'bot') {
      wrap.className = 'sd-msg-wrap bot';
      const fallbackLabel = msg.isFallback
        ? `<p class="sd-fallback-label">Not sure about that one</p>`
        : '';
      const agentName = escapeHtml(this._config.agent.name ?? 'Support');
      wrap.innerHTML = `
        <div class="sd-bot-avatar" aria-hidden="true"></div>
        <div class="sd-bot-body">
          <div class="sd-bot-meta">
            <span class="sd-bot-name">${agentName}</span>
            <span class="sd-timestamp">just now</span>
          </div>
          ${fallbackLabel}
          <div class="sd-bubble bot">${escapeHtml(msg.text)}</div>
        </div>
      `;
    } else {
      wrap.className = `sd-msg-wrap ${msg.role}`;
      let inner = '';
      if (msg.isFallback) {
        inner += `<p class="sd-fallback-label">Not sure about that one</p>`;
      }
      inner += `<div class="sd-bubble ${msg.role}">${escapeHtml(msg.text)}</div>`;
      inner += `<span class="sd-timestamp">just now</span>`;
      wrap.innerHTML = inner;
    }

    thread.appendChild(wrap);
    thread.scrollTop = thread.scrollHeight;
    this._renderChips();
  }

  private _showTyping(): void {
    if (this._isTyping) return;
    this._isTyping = true;

    const thread    = this._shadow.querySelector('.sd-thread') as HTMLElement;
    const theme     = this._theme;
    const indicator = document.createElement('div');
    indicator.id    = 'sd-typing-indicator';

    if (theme === 'light') {
      indicator.className = 'sd-typing';
      indicator.innerHTML = `
        <div class="sd-typing-avatar" aria-hidden="true"></div>
        <div class="sd-typing-dots">
          <span class="sd-dot"></span><span class="sd-dot"></span><span class="sd-dot"></span>
        </div>
      `;
    } else {
      indicator.className = 'sd-typing';
      indicator.innerHTML = '<span class="sd-dot"></span><span class="sd-dot"></span><span class="sd-dot"></span>';
    }

    thread.appendChild(indicator);
    thread.scrollTop = thread.scrollHeight;
  }

  private _hideTyping(): void {
    this._isTyping = false;
    const indicator = this._shadow.getElementById('sd-typing-indicator');
    if (indicator) indicator.remove();
  }

  private _renderChips(): void {
    const container = this._shadow.querySelector('.sd-chips') as HTMLElement;
    container.innerHTML = '';

    const allChips = extractChips(this._index ?? [], this._config.agent.suggestedChips);
    const askedTexts = new Set(
      this._messages
        .filter((m) => m.role === 'user')
        .map((m) => m.text.toLowerCase().trim())
    );
    const chips = allChips.filter((chip) => !askedTexts.has(chip.toLowerCase().trim()));

    if (chips.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';

    const theme = this._theme;
    if (this._hasSentMessage) {
      container.classList.add('scrollable');
    } else {
      container.classList.remove('scrollable');
    }

    if (theme === 'classic') {
      const label = document.createElement('div');
      label.className = 'sd-chips-label';
      label.textContent = 'Suggested';
      container.appendChild(label);

      const row = document.createElement('div');
      row.className = 'sd-chips-row';
      container.appendChild(row);

      for (const chipText of chips) {
        const btn = document.createElement('button');
        btn.className = 'sd-chip';
        btn.textContent = chipText;
        btn.addEventListener('click', () => this._submitChip(chipText));
        row.appendChild(btn);
      }
      return;
    }

    if (theme === 'dark' && !this._hasSentMessage) {
      const label = document.createElement('div');
      label.className = 'sd-chips-label';
      label.textContent = 'Try asking';
      container.appendChild(label);
    }

    for (const chipText of chips) {
      const btn = document.createElement('button');
      btn.className = 'sd-chip';
      if (theme === 'dark') {
        btn.innerHTML = `${ICON_CHEVRON} ${escapeHtml(chipText)}`;
      } else {
        btn.textContent = chipText;
      }
      btn.addEventListener('click', () => this._submitChip(chipText));
      container.appendChild(btn);
    }
  }

  private _submitChip(chipText: string): void {
    const input = this._shadow.querySelector('.sd-input') as HTMLInputElement;
    input.value = chipText;
    this._submit();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}
