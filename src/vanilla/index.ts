import { SageDeskWidget } from './widget.js';
import type { SageDeskConfig } from '../core/types.js';

const ELEMENT_TAG = 'sagedesk-widget';

// Validates required config fields and throws descriptive errors so developer
// mistakes surface immediately with a full stack trace, not as silent warns.
function assertConfig(config: SageDeskConfig): void {
  if (!config || typeof config !== 'object') {
    throw new Error('[sagedesk] init() requires a config object.');
  }
  if (!config.indexUrl || typeof config.indexUrl !== 'string') {
    throw new Error(
      '[sagedesk] config.indexUrl is required. ' +
      'Run `npx sagedesk build` and pass the output path as indexUrl.'
    );
  }
  if (!config.agent || typeof config.agent !== 'object') {
    throw new Error('[sagedesk] config.agent is required.');
  }
  if (!config.agent.name || typeof config.agent.name !== 'string') {
    throw new Error('[sagedesk] config.agent.name is required.');
  }
}

function init(config: SageDeskConfig): void {
  // assertConfig is intentionally outside the try/catch so developer config
  // mistakes always surface as thrown errors rather than being swallowed.
  assertConfig(config);

  try {
    if (typeof customElements === 'undefined') return;
    if (typeof document === 'undefined') return;

    if (!customElements.get(ELEMENT_TAG)) {
      customElements.define(ELEMENT_TAG, SageDeskWidget);
    }

    const existing = document.querySelector(ELEMENT_TAG) as SageDeskWidget | null;
    if (existing) {
      existing.init(config);
      return;
    }

    const el = document.createElement(ELEMENT_TAG) as SageDeskWidget;
    document.body.appendChild(el);
    el.init(config);
  } catch (err) {
    // Never crash the host page for runtime errors
    console.warn('[sagedesk] Failed to initialise:', err);
  }
}

// Expose on window for script-tag usage
if (typeof window !== 'undefined') {
  (window as Window & { SageDesk?: { init: typeof init } }).SageDesk = { init };
}

export { init };
export type { SageDeskConfig };
export { SageDeskWidget };
