import { describe, it, expect, vi, beforeEach } from 'vitest';
import { init } from '../../src/vanilla/index';

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));

vi.mock('./widget.js', () => ({
  SageDeskWidget: class extends HTMLElement {
    init = mockInit;
  },
}));

const VALID_CONFIG = { indexUrl: '/index.json', agent: { name: 'Bot' } } as any;

describe('vanilla index', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should define the custom element and append it to body', () => {
    const mockEl = document.createElement('div');
    (mockEl as any).init = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue(mockEl as any);
    vi.spyOn(document, 'querySelector').mockReturnValue(null);

    init(VALID_CONFIG);

    expect((mockEl as any).init).toHaveBeenCalledWith(VALID_CONFIG);
  });

  it('should use existing element if present', () => {
    const existing = document.createElement('sagedesk-widget');
    (existing as any).init = vi.fn();
    document.body.appendChild(existing);

    init(VALID_CONFIG);

    expect((existing as any).init).toHaveBeenCalledWith(VALID_CONFIG);
    expect(document.querySelectorAll('sagedesk-widget')).toHaveLength(1);
  });

  it('should expose init on window', () => {
    expect((window as any).SageDesk).toBeDefined();
    expect(typeof (window as any).SageDesk.init).toBe('function');
  });

  it('should handle runtime errors gracefully without crashing the host page', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Disable customElements to force a runtime failure inside the try block
    const saved = (window as any).customElements;
    (window as any).customElements = undefined;

    // Should not throw — runtime errors are swallowed and warned
    expect(() => init(VALID_CONFIG)).not.toThrow();

    (window as any).customElements = saved;
    spy.mockRestore();
  });

  describe('config validation', () => {
    it('should throw when config is missing entirely', () => {
      expect(() => init(undefined as any)).toThrow('[sagedesk] init() requires a config object');
    });

    it('should throw when indexUrl is missing', () => {
      expect(() => init({ agent: { name: 'Bot' } } as any)).toThrow('config.indexUrl is required');
    });

    it('should throw when agent is missing', () => {
      expect(() => init({ indexUrl: '/index.json' } as any)).toThrow('config.agent is required');
    });

    it('should throw when agent.name is missing', () => {
      expect(() => init({ indexUrl: '/index.json', agent: {} } as any)).toThrow('config.agent.name is required');
    });
  });
});
