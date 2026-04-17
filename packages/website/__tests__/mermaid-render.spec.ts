// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeMock = vi.fn();
const renderMock = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    initialize: (...args: unknown[]) => initializeMock(...args),
    render: (...args: unknown[]) => renderMock(...args),
  },
}));

function createMarkdownBody(content = 'graph TD\nA-->B') {
  const markdownBody = document.createElement('div');
  markdownBody.className = 'markdown-body';
  markdownBody.innerHTML = `<pre><code class="language-mermaid">${content}</code></pre>`;
  document.body.appendChild(markdownBody);
  return markdownBody;
}

async function flushMermaidRender() {
  await vi.dynamicImportSettled();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('website mermaid render fallback', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    renderMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('replaces raw mermaid code blocks with rendered svg output', async () => {
    const { customMermaidPlugin } = await import('../components/Markdown/mermaidTheme');
    renderMock.mockResolvedValue({
      svg: '<svg data-testid="mermaid-svg"></svg>',
    });

    const markdownBody = createMarkdownBody();
    const plugin = customMermaidPlugin('dark');

    plugin.viewerEffect?.({ markdownBody } as never);
    await flushMermaidRender();

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'dark',
        startOnLoad: false,
      }),
    );
    expect(renderMock).toHaveBeenCalledWith(
      expect.stringContaining('vb-mermaid-'),
      'graph TD\nA-->B',
    );
    expect(markdownBody.querySelector('.bytemd-mermaid svg')).toBeTruthy();
    expect(markdownBody.querySelector('pre')).toBeNull();
  });

  it('keeps the original code block when Mermaid render fails', async () => {
    const { customMermaidPlugin } = await import('../components/Markdown/mermaidTheme');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderMock.mockRejectedValue(new Error('bad mermaid'));

    const markdownBody = createMarkdownBody('graph TD\nA--x B');
    const plugin = customMermaidPlugin('light');

    plugin.viewerEffect?.({ markdownBody } as never);
    await flushMermaidRender();

    expect(markdownBody.querySelector('pre code.language-mermaid')?.textContent).toContain('A--x B');
    expect(markdownBody.querySelector('.bytemd-mermaid')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('renders mermaid blocks inserted after the initial viewer effect', async () => {
    const { customMermaidPlugin } = await import('../components/Markdown/mermaidTheme');
    renderMock.mockResolvedValue({
      svg: '<svg data-testid="observer-svg"></svg>',
    });

    const markdownBody = document.createElement('div');
    markdownBody.className = 'markdown-body';
    document.body.appendChild(markdownBody);

    const plugin = customMermaidPlugin('light');
    plugin.viewerEffect?.({ markdownBody } as never);

    markdownBody.innerHTML = `<pre><code class="language-mermaid">graph TD
A-->C</code></pre>`;
    await flushMermaidRender();

    expect(renderMock).toHaveBeenCalledWith(
      expect.stringContaining('vb-mermaid-'),
      'graph TD\nA-->C',
    );
    expect(markdownBody.querySelector('.bytemd-mermaid svg')).toBeTruthy();
  });
});
