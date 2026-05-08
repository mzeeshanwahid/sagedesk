'use client';

import { useState, useEffect, Suspense, lazy } from 'react';
import type { SageDeskWidgetProps } from '../react/SageDeskWidget.js';

const LazyWidget = lazy(() =>
  import('../react/SageDeskWidget.js')
    .then((mod) => ({ default: mod.SageDeskWidget }))
    .catch((err) => {
      console.warn('[sagedesk] Failed to load widget bundle:', err);
      const Empty = () => null;
      return { default: Empty };
    })
);

export function SageDeskNext(props: SageDeskWidgetProps) {
  // useState + useEffect ensures server render and initial client hydration
  // both return null (no mismatch). The widget appears only after hydration.
  // Using typeof window directly in render body causes a hydration mismatch
  // in Next.js App Router because 'use client' components still SSR.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mode = props.mode ?? 'local';

    if (mode === 'local' && !props.indexUrl) {
      console.warn(
        '[sagedesk] Missing required prop: indexUrl. The widget will not load.\n' +
        'Make sure you ran `npx sagedesk build` and are passing indexUrl="/support-index.json" (or wherever you placed the output file in public/).'
      );
    } else if (mode === 'llm' && !props.endpoint) {
      console.warn(
        '[sagedesk] Missing required prop: endpoint for LLM mode. The widget will not load.\n' +
        'Provide your backend route, e.g. endpoint="/api/sagedesk".'
      );
    }

    if (props.indexUrl && !props.indexUrl.startsWith('/') && !props.indexUrl.startsWith('http')) {
      console.warn(
        `[sagedesk] indexUrl "${props.indexUrl}" looks like a relative path. ` +
        'It should start with "/" (e.g. "/support-index.json") so it resolves correctly from any page.'
      );
    }
    setMounted(true);
  }, [props.mode, props.indexUrl, props.endpoint]);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <LazyWidget {...props} />
    </Suspense>
  );
}
