import React from 'react';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { SageDeskWidget } from '../../src/react/SageDeskWidget';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useSageDeskModule from '../../src/react/useSageDesk';

vi.mock('../../src/react/useSageDesk', () => ({
  useSageDesk: vi.fn(),
}));

describe('SageDeskWidget React', () => {
  const config = {
    indexUrl: 'index.json',
    agent: {
      name: 'React Bot',
      greeting: 'Hello!',
    },
  };

  const mockUseSageDesk = {
    state: {
      messages: [],
      isOpen: false,
      isTyping: false,
      engineStatus: 'idle',
      engineError: null,
      hasSentMessage: false,
    },
    chips: ['Chip 1'],
    open: vi.fn(),
    close: vi.fn(),
    submit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSageDeskModule.useSageDesk).mockReturnValue(mockUseSageDesk as any);
  });

  it('should render trigger button', () => {
    render(<SageDeskWidget {...config} />);
    expect(screen.getByLabelText('Open support chat')).toBeInTheDocument();
  });

  it('should call open when trigger clicked', () => {
    render(<SageDeskWidget {...config} />);
    fireEvent.click(screen.getByLabelText('Open support chat'));
    expect(mockUseSageDesk.open).toHaveBeenCalled();
  });

  it('should render panel when open', () => {
    vi.mocked(useSageDeskModule.useSageDesk).mockReturnValue({
      ...mockUseSageDesk,
      state: { ...mockUseSageDesk.state, isOpen: true },
    } as any);

    render(<SageDeskWidget {...config} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('React Bot')).toBeInTheDocument();
    expect(screen.getByText('Chip 1')).toBeInTheDocument();
  });

  it('should handle input change and submit', () => {
    vi.mocked(useSageDeskModule.useSageDesk).mockReturnValue({
      ...mockUseSageDesk,
      state: { ...mockUseSageDesk.state, isOpen: true },
    } as any);

    render(<SageDeskWidget {...config} />);
    const input = screen.getByLabelText('Type your question') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'How to?' } });
    expect(input.value).toBe('How to?');

    fireEvent.click(screen.getByLabelText('Send message'));
    expect(mockUseSageDesk.submit).toHaveBeenCalledWith('How to?');
    expect(input.value).toBe('');
  });

  it('should handle enter key to submit', () => {
    vi.mocked(useSageDeskModule.useSageDesk).mockReturnValue({
      ...mockUseSageDesk,
      state: { ...mockUseSageDesk.state, isOpen: true },
    } as any);

    render(<SageDeskWidget {...config} />);
    const input = screen.getByLabelText('Type your question');
    fireEvent.change(input, { target: { value: 'Enter text' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(mockUseSageDesk.submit).toHaveBeenCalledWith('Enter text');
  });

  it('should call close when close button clicked', async () => {
    vi.useFakeTimers();
    vi.mocked(useSageDeskModule.useSageDesk).mockReturnValue({
      ...mockUseSageDesk,
      state: { ...mockUseSageDesk.state, isOpen: true },
    } as any);

    render(<SageDeskWidget {...config} />);
    fireEvent.click(screen.getByLabelText('Close chat'));
    
    // handleClose has a timeout
    act(() => {
      vi.runAllTimers();
    });
    
    expect(mockUseSageDesk.close).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
