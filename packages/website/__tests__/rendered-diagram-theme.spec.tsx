// @vitest-environment jsdom
import React, { act, StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeContext } from '../utils/themeContext';

let mermaidTheme = 'default';
const mermaidRender = vi.fn(async (..._args: unknown[]) => ({
  svg: `<svg data-theme="${mermaidTheme}"></svg>`,
}));
const krokiRender = vi.fn(
  async (...args: any[]) =>
    `<svg xmlns="http://www.w3.org/2000/svg" data-theme="${args[2].themeMode}"></svg>`,
);
const waveRender = vi.fn(
  async (...args: any[]) =>
    `<svg xmlns="http://www.w3.org/2000/svg" data-theme="${args[1].themeMode}"></svg>`,
);

vi.mock('mermaid', () => ({
  default: {
    initialize: (config) => {
      mermaidTheme = config.theme;
    },
    render: (...args) => mermaidRender(...args),
  },
}));
vi.mock('../components/Markdown/diagrams/krokiRenderer', () => ({
  renderWithKroki: (...args) => krokiRender(...args),
}));
vi.mock('../components/Markdown/diagrams/wavedromRenderer', () => ({
  renderWaveDrom: (...args) => waveRender(...args),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('rendered diagram themes', () => {
  let root: Root;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('redraws Mermaid, Kroki and WaveDrom with fresh export controls while retaining code state', async () => {
    const { default: RenderedMarkdown } = await import('../components/RenderedMarkdown');
    const { renderMarkdownToHtml } = await import('../utils/renderMarkdown');
    const content = [
      '```bash',
      'echo first',
      '```',
      '',
      '```mermaid',
      'graph TD; A-->B',
      '```',
      '',
      '```plantuml',
      '@startuml\nAlice -> Bob\n@enduml',
      '```',
      '',
      '```wavedrom',
      '{"signal":[{"name":"clk","wave":"p..."}]}',
      '```',
    ].join('\n');
    const html = renderMarkdownToHtml(content);
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    let codeNode: Element | undefined;
    let previousToolbar: Element | undefined;
    const blobs: Blob[] = [];
    const createUrl = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:test';
    });
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    for (const theme of ['light', 'dark', 'light'] as const) {
      await act(async () =>
        root.render(
          <StrictMode>
            <ThemeContext.Provider value={{ theme, setTheme: () => {} }}>
              <RenderedMarkdown html={html} content={content} />
            </ThemeContext.Provider>
          </StrictMode>,
        ),
      );
      await act(async () => {
        await vi.dynamicImportSettled();
      });
      const deadline = Date.now() + 2000;
      while (
        container
          .querySelector('.vb-diagram-container')
          ?.getAttribute('data-vb-diagram-rendered') !== theme &&
        Date.now() < deadline
      ) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      }
      expect(container.querySelector('.bytemd-mermaid svg')?.getAttribute('data-theme')).toBe(
        theme === 'light' ? 'default' : 'dark',
      );
      expect(container.querySelectorAll('.vb-diagram-container')).toHaveLength(2);
      container.querySelectorAll('.vb-diagram-container').forEach((diagram) => {
        expect(diagram.getAttribute('data-vb-diagram-rendered')).toBe(theme);
        expect(diagram.querySelector('svg')?.getAttribute('data-theme')).toBe(theme);
        expect(diagram.querySelectorAll('.vb-diagram-toolbar')).toHaveLength(1);
      });
      const toolbar = container.querySelector('.vb-mermaid-toolbar')!;
      expect(toolbar).toBeTruthy();
      expect(toolbar).not.toBe(previousToolbar);
      previousToolbar = toolbar;
      const code = container.querySelector('.code-content-wrapper')!;
      if (!codeNode) {
        codeNode = code;
        container.querySelector<HTMLElement>('.code-wrap-btn')!.click();
      }
      expect(code).toBe(codeNode);
      expect(code.classList.contains('code-wrap-enabled')).toBe(false);
      container.querySelector<HTMLButtonElement>('.vb-diagram-action-btn')!.click();
      const exported = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blobs[blobs.length - 1]);
      });
      expect(exported).toContain(theme === 'dark' ? '#0f172a' : '#ffffff');
    }
    expect(mermaidRender).toHaveBeenCalledTimes(3);
    expect(krokiRender).toHaveBeenCalledTimes(3);
    expect(waveRender).toHaveBeenCalledTimes(3);
  });
});
