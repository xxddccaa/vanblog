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

  it('keeps text after a single-line bracket formula', () => {
    const html = provider.renderMarkdown('\\[a\\] 后面的 **正文**');

    expect(html).toContain('katex-display');
    expect(html).toContain('<p>后面的 <strong>正文</strong></p>');
  });

  it('keeps code examples with bracket delimiters untouched', () => {
    const html = provider.renderMarkdown(['```ts', 'const formula = "\\(E=mc^2\\)";', '```'].join('\n'));

    expect(html).toContain('\\(E=mc^2\\)');
    expect(html).not.toContain('katex');
  });

  it('renders a multi-line bracket block, including right after a text line', () => {
    const formula = ['\\[', 'Q,\\quad R', '\\]'].join('\n');

    expect(provider.renderMarkdown(formula)).toContain('katex-display');
    expect(provider.renderMarkdown(`下面是公式：\n${formula}`)).toContain('katex-display');
  });

  // 回归：旧的字符串预处理遇到未闭合的行内反引号会整篇熄火
  it('still renders formulas after an unclosed inline backtick', () => {
    const html = provider.renderMarkdown('代码 `x 未闭合\n\n\\[\nQ,\\quad R\n\\]');

    expect(html).toContain('katex-display');
  });

  // 回归：旧的字符串预处理把 4 空格缩进当成 indented code
  it('renders formulas indented inside a list item', () => {
    const html = provider.renderMarkdown(
      ['- item', '', '    \\[', '    Q,\\quad R', '    \\]'].join('\n'),
    );

    expect(html).toContain('katex-display');
    expect(html).not.toContain('\\[');
  });

  it('renders formulas inside a blockquote without swallowing the quote marker', () => {
    const html = provider.renderMarkdown(['> \\[', '> Q,\\quad R', '> \\]'].join('\n'));

    expect(html).toContain('<blockquote>');
    expect(html).toContain('<annotation encoding="application/x-tex">Q,\\quad R</annotation>');
  });

  it('passes LaTeX backslash escapes through verbatim', () => {
    const html = provider.renderMarkdown(
      ['\\[', '\\begin{aligned}a &= b \\\\ c &= d\\end{aligned}', '\\]'].join('\n'),
    );

    expect(html).toContain('b \\\\ c');
    expect(html).not.toContain('katex-error');
    expect((html.match(/<mtr/g) || []).length).toBe(2);
  });

  it('keeps unclosed or escaped bracket delimiters literal', () => {
    expect(provider.renderMarkdown('\\[a\n\nb\\]')).not.toContain('katex');
    expect(provider.renderMarkdown('\\\\[\nQ\n\\\\]')).not.toContain('katex');
    expect(provider.renderMarkdown('前 \\(a+\nb\\) 后')).not.toContain('katex');
  });

  it('still renders dollar delimiters', () => {
    expect(provider.renderMarkdown('行内 $E=mc^2$')).toContain('katex');
    expect(provider.renderMarkdown('$$\n\\int_0^1 x^2 dx\n$$')).toContain('katex-display');
  });

  // 公式内容一律按原文取，内部这些「像 markdown 语法」的写法不会破坏公式
  it('renders formulas whose body looks like inline markdown', () => {
    expect(provider.renderMarkdown('\\[a_{i:j}\\]')).toContain('katex');
    expect(provider.renderMarkdown('\\[a ~b~ c\\]')).toContain('katex');
    expect(provider.renderMarkdown('\\[[a](b)\\]')).toContain('katex');
    expect(provider.renderMarkdown('\\(a_{i:j}\\)')).toContain('katex');
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
