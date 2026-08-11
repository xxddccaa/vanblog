import { MarkdownProvider } from './markdown.provider';

describe('MarkdownProvider', () => {
  const provider = new MarkdownProvider();

  it('renders bracket formula delimiters as KaTeX HTML', () => {
    const html = provider.renderMarkdown('行内 \\(E=mc^2\\)\n\n\\[\\int_0^1 x^2 dx\\]');

    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
    expect(html).toContain('<math');
    expect(html).toContain('style="height:');
    expect(html).not.toContain('\\(');
    expect(html).not.toContain('\\[');
  });

  it('keeps code examples with bracket delimiters untouched', () => {
    const html = provider.renderMarkdown(['```ts', 'const formula = "\\(E=mc^2\\)";', '```'].join('\n'));

    expect(html).toContain('\\(E=mc^2\\)');
    expect(html).not.toContain('katex');
  });

  it('removes executable raw HTML, event handlers and unsafe URLs', () => {
    const html = provider.renderMarkdown(
      '<script>alert(1)</script><img src="javascript:alert(2)" onerror="alert(3)"><iframe srcdoc="<script>alert(4)</script>"></iframe>',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<iframe');
  });

  it('drops arbitrary inline CSS while preserving allowlisted KaTeX layout styles', () => {
    const html = provider.renderMarkdown(
      '<span style="background:url(https://attacker.invalid/leak);position:fixed">红字</span> **粗体** $E=mc^2$',
    );

    expect(html).toContain('<span>红字</span>');
    expect(html).toContain('<strong>粗体</strong>');
    expect(html).toContain('style="height:');
    expect(html).not.toContain('background:');
    expect(html).not.toContain('position:fixed');
  });
});
