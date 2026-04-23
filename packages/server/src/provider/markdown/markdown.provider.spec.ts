import { MarkdownProvider } from './markdown.provider';

describe('MarkdownProvider', () => {
  const provider = new MarkdownProvider();

  it('renders bracket formula delimiters as KaTeX HTML', () => {
    const html = provider.renderMarkdown('行内 \\(E=mc^2\\)\n\n\\[\\int_0^1 x^2 dx\\]');

    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('\\(');
    expect(html).not.toContain('\\[');
  });

  it('keeps code examples with bracket delimiters untouched', () => {
    const html = provider.renderMarkdown(['```ts', 'const formula = "\\(E=mc^2\\)";', '```'].join('\n'));

    expect(html).toContain('\\(E=mc^2\\)');
    expect(html).not.toContain('katex');
  });
});
