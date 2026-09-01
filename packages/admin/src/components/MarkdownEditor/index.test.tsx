import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EDITOR_ENGINE_STORAGE_KEY } from './utils';

type EngineLoads = {
  bytemd: number;
  milkdown: number;
};

const getEngineLoads = () =>
  (globalThis as typeof globalThis & { __engineLoads: EngineLoads }).__engineLoads;

vi.mock('antd', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Spin: () => <div data-testid="editor-spin" />,
}));

vi.mock('./engines/bytemd', () => {
  getEngineLoads().bytemd += 1;
  return {
    default: () => <div data-testid="bytemd-engine" />,
  };
});

vi.mock('./engines/milkdown', () => {
  getEngineLoads().milkdown += 1;
  return {
    default: () => <div data-testid="milkdown-engine" />,
  };
});

const editorProps = {
  value: '',
  onChange: vi.fn(),
  loading: false,
  setLoading: vi.fn(),
};

describe('MarkdownEditor engine loading', () => {
  beforeEach(() => {
    vi.resetModules();
    (globalThis as typeof globalThis & { __engineLoads: EngineLoads }).__engineLoads = {
      bytemd: 0,
      milkdown: 0,
    };
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads only the default Bytemd engine', async () => {
    const { default: MarkdownEditor } = await import('./index');

    render(<MarkdownEditor {...editorProps} />);

    expect(screen.getByTestId('markdown-editor-loading')).not.toBeNull();
    expect(await screen.findByTestId('bytemd-engine')).not.toBeNull();
    expect(getEngineLoads().bytemd).toBe(1);
    expect(getEngineLoads().milkdown).toBe(0);
  });

  it('loads only the persisted Milkdown engine without starting Bytemd first', async () => {
    window.localStorage.setItem(EDITOR_ENGINE_STORAGE_KEY, 'milkdown');
    const { default: MarkdownEditor } = await import('./index');

    render(<MarkdownEditor {...editorProps} />);

    expect(await screen.findByTestId('milkdown-engine')).not.toBeNull();
    expect(getEngineLoads().milkdown).toBe(1);
    expect(getEngineLoads().bytemd).toBe(0);
  });

  it('shows a retryable error and recreates the lazy loader after a rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { default: MarkdownEditor } = await import('./index');
    const RetryEngine = () => <div data-testid="retry-engine" />;
    const bytemdLoader = vi
      .fn()
      .mockRejectedValueOnce(new Error('bytemd chunk failed'))
      .mockResolvedValueOnce({ default: RetryEngine });
    const milkdownLoader = vi.fn();

    render(
      <MarkdownEditor
        {...editorProps}
        engineLoaders={{
          bytemd: bytemdLoader,
          milkdown: milkdownLoader,
        }}
      />,
    );

    expect(await screen.findByTestId('markdown-editor-error')).not.toBeNull();
    expect(bytemdLoader).toHaveBeenCalledTimes(1);
    expect(milkdownLoader).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.queryByTestId('markdown-editor-error')).toBeNull());
    expect(await screen.findByTestId('retry-engine')).not.toBeNull();
    expect(bytemdLoader).toHaveBeenCalledTimes(2);
  });
});
