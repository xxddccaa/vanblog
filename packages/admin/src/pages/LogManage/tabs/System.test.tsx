import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SystemLog } from './System';

vi.mock('@/components/TerminalDisplay', () => ({
  default: ({ content }: { content: string }) => <span data-testid="terminal">{content}</span>,
}));

vi.mock('antd', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children }: any) => <section>{children}</section>,
  Space: ({ children }: any) => <div>{children}</div>,
  Spin: ({ children }: any) => <div>{children}</div>,
}));

const getSystemLogTailMock = vi.fn();
const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('System log polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getSystemLogTailMock
      .mockResolvedValueOnce({
        data: {
          data: ['initial'],
          nextCursor: 'cursor-1',
          reset: true,
        },
      } as any)
      .mockResolvedValue({
        data: {
          data: ['increment'],
          nextCursor: 'cursor-2',
          reset: false,
        },
      } as any);
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('polls incrementally, pauses while hidden and cleans up on unmount', async () => {
    const view = render(<SystemLog fetchTail={getSystemLogTailMock} />);
    await flushPromises();
    expect(getSystemLogTailMock).toHaveBeenCalledWith(null, 1000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushPromises();
    expect(getSystemLogTailMock).toHaveBeenLastCalledWith('cursor-1', 1000);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getSystemLogTailMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(getSystemLogTailMock).toHaveBeenCalledTimes(3);

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getSystemLogTailMock).toHaveBeenCalledTimes(3);
  });

  it('lets a manual reset supersede an older pending request', async () => {
    let resolveInitial: (value: any) => void = () => undefined;
    getSystemLogTailMock
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInitial = resolve;
          }),
      )
      .mockResolvedValueOnce({
        data: {
          data: ['fresh'],
          nextCursor: 'fresh-cursor',
          reset: true,
        },
      });

    const view = render(<SystemLog fetchTail={getSystemLogTailMock} />);
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: '手动刷新' }));
    await flushPromises();

    expect(getSystemLogTailMock).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).toContain('fresh');

    resolveInitial({
      data: {
        data: ['stale'],
        nextCursor: 'stale-cursor',
        reset: true,
      },
    });
    await flushPromises();

    expect(view.container.textContent).toContain('fresh');
    expect(view.container.textContent).not.toContain('stale');
  });
});
