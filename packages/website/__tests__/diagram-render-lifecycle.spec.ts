// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderMermaid = vi.fn();
const renderKroki = vi.fn();
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: (...args: unknown[]) => renderMermaid(...args) },
}));
vi.mock('../components/Markdown/diagrams/krokiRenderer', () => ({
  renderWithKroki: (...args: unknown[]) => renderKroki(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('diagram render request ownership', () => {
  beforeEach(() => {
    renderMermaid.mockReset();
    renderKroki.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(['mermaid', 'plantuml'])(
    'commits the latest theme when %s rendering is delayed',
    async (language) => {
      const { renderMermaidBlocks } = await import('../components/Markdown/mermaidTheme');
      const { renderDiagramBlocks } = await import(
        '../components/Markdown/diagrams/renderDiagramBlocks'
      );
      const render = language === 'mermaid' ? renderMermaidBlocks : renderDiagramBlocks;
      const renderer = language === 'mermaid' ? renderMermaid : renderKroki;
      const pack = (svg: string) => (language === 'mermaid' ? { svg } : svg);
      const old = deferred<any>();
      renderer
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue(pack('<svg data-theme="dark"></svg>'));
      document.body.innerHTML = `<pre><code class="language-${language}">source</code></pre>`;
      const first = render(document.body, 'light');
      await vi.dynamicImportSettled();
      expect(renderer).toHaveBeenCalledTimes(1);
      const second = render(document.body, 'dark');
      old.resolve(pack('<svg data-theme="light"></svg>'));
      await Promise.all([first, second]);
      expect(document.querySelector('svg')?.getAttribute('data-theme')).toBe('dark');
      expect(document.querySelectorAll('svg')).toHaveLength(1);
      await render(document.body, 'dark');
      expect(renderer).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['mermaid', 'plantuml'])(
    'does not commit %s output after the owning effect is disposed',
    async (language) => {
      const { renderMermaidBlocks } = await import('../components/Markdown/mermaidTheme');
      const { renderDiagramBlocks } = await import(
        '../components/Markdown/diagrams/renderDiagramBlocks'
      );
      const render = language === 'mermaid' ? renderMermaidBlocks : renderDiagramBlocks;
      const renderer = language === 'mermaid' ? renderMermaid : renderKroki;
      const pending = deferred<any>();
      renderer.mockReturnValueOnce(pending.promise);
      document.body.innerHTML = `<pre><code class="language-${language}">old source</code></pre>`;
      let active = true;
      const first = render(document.body, 'light', () => active);
      await vi.dynamicImportSettled();
      expect(renderer).toHaveBeenCalledTimes(1);
      active = false;
      pending.resolve(language === 'mermaid' ? { svg: '<svg></svg>' } : '<svg></svg>');
      await first;
      expect(document.querySelector('svg')).toBeNull();
      expect(document.querySelector('code')?.textContent).toBe('old source');
    },
  );

  it('cancels an in-flight redraw when switching back to the displayed theme', async () => {
    const { renderDiagramBlocks } = await import(
      '../components/Markdown/diagrams/renderDiagramBlocks'
    );
    document.body.innerHTML = '<pre><code class="language-plantuml">source</code></pre>';
    renderKroki.mockResolvedValueOnce('<svg data-theme="light"></svg>');
    await renderDiagramBlocks(document.body, 'light');
    const pending = deferred<string>();
    renderKroki.mockReturnValueOnce(pending.promise);
    const dark = renderDiagramBlocks(document.body, 'dark');
    await renderDiagramBlocks(document.body, 'light');
    pending.resolve('<svg data-theme="dark"></svg>');
    await dark;
    expect(document.querySelector('svg')?.getAttribute('data-theme')).toBe('light');
  });
});
