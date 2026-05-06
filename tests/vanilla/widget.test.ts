import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { SageDeskWidget } from '../../src/vanilla/widget';
import * as retriever from '../../src/core/retriever';
import * as renderer from '../../src/core/renderer';
import * as fallback from '../../src/core/fallback';

vi.mock('../../src/core/retriever', () => ({
  fetchIndex: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock('../../src/core/renderer', () => ({
  buildAnswer: vi.fn(),
  extractChips: vi.fn().mockReturnValue(['Chip 1', 'Chip 2']),
}));

vi.mock('../../src/core/fallback', () => ({
  getFallback: vi.fn().mockReturnValue('Fallback message'),
}));

// Mock EmbedderRuntime
vi.mock('../../src/core/embedder', () => {
  return {
    EmbedderRuntime: vi.fn().mockImplementation(() => ({
      load: vi.fn().mockResolvedValue(undefined),
      embed: vi.fn().mockResolvedValue(new Float32Array([0.1])),
      isReady: true,
    })),
  };
});

describe('SageDeskWidget', () => {
  let widget: SageDeskWidget;
  const config = {
    indexUrl: 'index.json',
    agent: {
      name: 'Test Bot',
      greeting: 'Hello!',
      accentColor: '#123456',
    },
  };

  beforeAll(() => {
    customElements.define('sagedesk-widget', SageDeskWidget);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    widget = document.createElement('sagedesk-widget') as SageDeskWidget;
    document.body.appendChild(widget);
  });

  afterEach(() => {
    document.body.removeChild(widget);
  });

  it('should initialize and mount', () => {
    widget.init(config);
    const shadow = widget.shadowRoot!;
    expect(shadow).not.toBeNull();
    expect(shadow.querySelector('.sd-agent-name')?.textContent).toBe('Test Bot');
    expect(shadow.querySelector('.sd-trigger')).not.toBeNull();
  });

  it('should open the panel and show greeting', async () => {
    widget.init(config);
    const trigger = widget.shadowRoot!.querySelector('.sd-trigger') as HTMLButtonElement;
    
    trigger.click();
    
    const panel = widget.shadowRoot!.querySelector('.sd-panel') as HTMLElement;
    expect(panel.getAttribute('data-open')).toBe('true');
    
    const thread = widget.shadowRoot!.querySelector('.sd-thread') as HTMLElement;
    expect(thread.textContent).toContain('Hello!');
  });

  it('should close the panel', async () => {
    widget.init(config);
    const trigger = widget.shadowRoot!.querySelector('.sd-trigger') as HTMLButtonElement;
    trigger.click();
    
    const closeBtn = widget.shadowRoot!.querySelector('.sd-close') as HTMLButtonElement;
    closeBtn.click();
    
    const panel = widget.shadowRoot!.querySelector('.sd-panel') as HTMLElement;
    // Dispatch animationend because jsdom doesn't do it
    panel.dispatchEvent(new Event('animationend'));
    
    expect(panel.getAttribute('data-open')).toBe('false');
  });

  it('should submit a message and show typing indicator', async () => {
    vi.useFakeTimers();
    vi.mocked(retriever.fetchIndex).mockResolvedValue([{ text: 'data' }] as any);
    vi.mocked(retriever.retrieve).mockResolvedValue({ results: [{ chunk: { text: 'Answer' } }], mode: 'vector' } as any);
    vi.mocked(renderer.buildAnswer).mockReturnValue('This is the answer');

    widget.init(config);
    await (widget as any)._open(); // Open to initialize engine

    const input = widget.shadowRoot!.querySelector('.sd-input') as HTMLInputElement;
    const sendBtn = widget.shadowRoot!.querySelector('.sd-send') as HTMLButtonElement;

    input.value = 'How are you?';
    sendBtn.click();

    const thread = widget.shadowRoot!.querySelector('.sd-thread') as HTMLElement;
    expect(thread.textContent).toContain('How are you?');
    expect(widget.shadowRoot!.querySelector('.sd-typing')).not.toBeNull();

    // Fast-forward typing delay
    await vi.runAllTimersAsync();

    expect(widget.shadowRoot!.querySelector('.sd-typing')).toBeNull();
    expect(thread.textContent).toContain('This is the answer');
    
    vi.useRealTimers();
  });

  it('should handle escape key to close', () => {
     widget.init(config);
     (widget as any)._open();
     const panel = widget.shadowRoot!.querySelector('.sd-panel') as HTMLElement;
     panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
     expect(panel.getAttribute('data-closing')).toBe('true');
  });

  it('should handle chips', async () => {
    vi.mocked(renderer.extractChips).mockReturnValue(['Help', 'Pricing']);
    widget.init(config);
    await (widget as any)._open();
    
    const chips = widget.shadowRoot!.querySelectorAll('.sd-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toBe('Help');
    
    (chips[0] as HTMLButtonElement).click();
    const thread = widget.shadowRoot!.querySelector('.sd-thread') as HTMLElement;
    expect(thread.textContent).toContain('Help');
  });

  it('should filter out chips once asked', async () => {
    vi.mocked(renderer.extractChips).mockReturnValue(['Help', 'Pricing']);
    widget.init(config);
    await (widget as any)._open();

    let chips = widget.shadowRoot!.querySelectorAll('.sd-chip');
    expect(chips).toHaveLength(2);

    // Ask "Help"
    (chips[0] as HTMLButtonElement).click();

    // Chips should re-render and "Help" should be gone
    chips = widget.shadowRoot!.querySelectorAll('.sd-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toBe('Pricing');
  });
});
