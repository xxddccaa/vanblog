// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeContext } from '../utils/themeContext';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const customMermaidPluginMock = vi.fn((themeMode: string) => ({
  name: `mermaid-${themeMode}`,
}));

vi.mock('@bytemd/react', () => ({
  Viewer: ({ plugins }: { plugins: Array<{ name?: string }> }) =>
    React.createElement('div', {
      'data-testid': 'mock-viewer',
      'data-plugin-names': plugins.map((plugin) => plugin?.name || 'plugin').join(','),
    }),
}));

vi.mock('@bytemd/plugin-gfm', () => ({
  default: () => ({ name: 'gfm' }),
}));

vi.mock('@bytemd/plugin-highlight-ssr', () => ({
  default: () => ({ name: 'highlight' }),
}));

vi.mock('@bytemd/plugin-math-ssr', () => ({
  default: () => ({ name: 'math' }),
}));

vi.mock('katex/dist/katex.min.css', () => ({}));

vi.mock('../components/Markdown/mermaidTheme', () => ({
  customMermaidPlugin: (themeMode: string) => customMermaidPluginMock(themeMode),
  normalizeMermaidThemeMode: (themeMode?: string) => (themeMode === 'dark' ? 'dark' : 'light'),
}));

vi.mock('../components/Markdown/customContainer', () => ({
  customContainer: () => ({ name: 'container' }),
}));

vi.mock('../components/Markdown/rawHTML', () => ({
  default: () => ({ name: 'raw-html' }),
}));

vi.mock('../components/Markdown/codeBlock', () => ({
  customCodeBlock: () => ({ name: 'code-block' }),
}));

vi.mock('../components/Markdown/linkTarget', () => ({
  LinkTarget: () => ({ name: 'link-target' }),
}));

vi.mock('../components/Markdown/heading', () => ({
  Heading: () => ({ name: 'heading' }),
}));

vi.mock('../components/Markdown/img', () => ({
  Img: () => ({ name: 'img' }),
}));

describe('markdown mermaid theme binding', () => {
  afterEach(() => {
    customMermaidPluginMock.mockClear();
    document.body.innerHTML = '';
  });

  it('rebuilds the Mermaid plugin when the site theme changes', async () => {
    const { default: Markdown } = await import('../components/Markdown');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          ThemeContext.Provider,
          {
            value: {
              theme: 'dark',
              setTheme: vi.fn(),
            },
          },
          React.createElement(Markdown, {
            content: '```mermaid\ngraph TD\nA-->B\n```',
          }),
        ),
      );
    });

    expect(customMermaidPluginMock).toHaveBeenLastCalledWith('dark');
    expect(container.querySelector("[data-vb-mermaid-theme='dark']")).toBeTruthy();

    await act(async () => {
      root.render(
        React.createElement(
          ThemeContext.Provider,
          {
            value: {
              theme: 'light',
              setTheme: vi.fn(),
            },
          },
          React.createElement(Markdown, {
            content: '```mermaid\ngraph TD\nA-->B\n```',
          }),
        ),
      );
    });

    expect(customMermaidPluginMock).toHaveBeenLastCalledWith('light');
    expect(container.querySelector("[data-vb-mermaid-theme='light']")).toBeTruthy();

    await act(async () => {
      root.unmount();
    });
  });
});
