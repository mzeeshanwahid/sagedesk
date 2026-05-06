import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { SageDeskNext } from '../../src/next/SageDeskNext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LazyWidget's target
vi.mock('../../src/react/SageDeskWidget.js', () => ({
  SageDeskWidget: () => <div data-testid="mock-widget">Mock Widget</div>,
}));

describe('SageDeskNext', () => {
  const props = {
    indexUrl: '/index.json',
    agent: { name: 'Next Bot' },
  };

  it('should render null initially and then render widget after mount', async () => {
    const { container, rerender } = render(<SageDeskNext {...props} />);
    expect(container.firstChild).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId('mock-widget')).toBeInTheDocument();
    });
  });

  it('should warn if indexUrl is missing', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SageDeskNext {...{ agent: {} } as any} />);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Missing required prop: indexUrl'));
    spy.mockRestore();
  });

  it('should warn if indexUrl is relative', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SageDeskNext {...props} indexUrl="relative.json" />);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('looks like a relative path'));
    spy.mockRestore();
  });
});
