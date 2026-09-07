// @vitest-environment jsdom
import React, { act, StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeContext } from '../utils/themeContext';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';

vi.mock('../components/Markdown/diagrams/renderDiagramBlocks', () => ({
  renderDiagramBlocks: vi.fn(),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('rendered markdown lifecycle', () => {
  let root: Root;

  afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.innerHTML = '';
  });

  it('rebinds controls and zoom after theme and HTML changes in StrictMode', async () => {
    const { default: RenderedMarkdown } = await import('../components/RenderedMarkdown');
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const render = async (content: string, theme: 'light' | 'dark') => {
      await act(async () => {
        root.render(
          <StrictMode>
            <ThemeContext.Provider value={{ theme, setTheme: () => {} }}>
              <RenderedMarkdown content={content} html={renderMarkdownToHtml(content)} />
            </ThemeContext.Provider>
          </StrictMode>,
        );
      });
      const deadline = Date.now() + 2000;
      while (
        !container.querySelector('img')?.classList.contains('medium-zoom-image') &&
        Date.now() < deadline
      ) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      }
      expect(container.querySelector('img')?.classList.contains('medium-zoom-image')).toBe(true);
      expect(container.querySelector<HTMLElement>('.code-toggle-btn')?.hidden).toBe(true);
    };
    const first = '```bash\necho first\n```\n\n![first](/first.png)';
    await render(first, 'dark');
    const oldImage = container.querySelector('img')!;
    const oldWrap = container.querySelector<HTMLElement>('.code-wrap-btn')!;
    const oldContent = container.querySelector<HTMLElement>('.code-content-wrapper')!;
    oldWrap.click();
    expect(oldContent.classList.contains('code-wrap-enabled')).toBe(false);

    await render(first, 'light');
    expect(container.querySelector('img')).toBe(oldImage);
    expect(oldContent.classList.contains('code-wrap-enabled')).toBe(false);
    oldWrap.click();
    expect(oldContent.classList.contains('code-wrap-enabled')).toBe(true);

    await render('```bash\necho replacement\n```\n\n![next](/next.png)', 'light');
    expect(container.querySelector('code')?.textContent).toContain('echo replacement');
    expect(container.querySelector('img')).not.toBe(oldImage);
    expect(oldImage.hasAttribute('data-zoomed')).toBe(false);
    oldWrap.click();
    expect(oldContent.classList.contains('code-wrap-enabled')).toBe(true);
    container.querySelector<HTMLElement>('.code-wrap-btn')!.click();
    expect(
      container.querySelector('.code-content-wrapper')!.classList.contains('code-wrap-enabled'),
    ).toBe(false);
  });
});
