import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';

const DISPLAY_FORMULA = ['\\[', 'Q,\\quad R', '\\]'].join('\n');

function countMatches(html: string, pattern: RegExp) {
  return (html.match(pattern) || []).length;
}

describe('bracket math delimiters', () => {
  it('renders a multi-line \\[...\\] block as display math', () => {
    const html = renderMarkdownToHtml(DISPLAY_FORMULA);

    expect(html).toContain('katex');
    expect(html).toContain('math-display');
    expect(html).not.toContain('\\[');
    // 块级公式必须是段落的兄弟节点，不能嵌在 <p> 里
    expect(html).not.toMatch(/<p>\s*<div class="math math-display"/);
  });

  it('renders a single-line \\[...\\] block as display math', () => {
    const html = renderMarkdownToHtml('\\[Q,\\quad R\\]');

    expect(html).toContain('katex');
    expect(html).toContain('math-display');
  });

  it('renders inline \\(...\\) as inline math', () => {
    const html = renderMarkdownToHtml('行内 \\(a+b\\) 结束');

    expect(html).toContain('katex');
    expect(html).toContain('math-inline');
    expect(html).toContain('行内');
    expect(html).toContain('结束');
    expect(html).not.toContain('\\(');
  });

  it('renders \\[ that directly follows a paragraph line without a blank line', () => {
    const html = renderMarkdownToHtml(`下面是公式：\n${DISPLAY_FORMULA}`);

    expect(html).toContain('下面是公式：');
    expect(html).toContain('math-display');
  });

  // 回归：旧的字符串预处理遇到未闭合的行内反引号会直接 break，
  // 导致该行之后整篇文档的公式全部失效
  it('still renders formulas after an unclosed inline backtick', () => {
    const html = renderMarkdownToHtml(`代码 \`x 未闭合\n\n${DISPLAY_FORMULA}`);

    expect(html).toContain('math-display');
    expect(html).toContain('katex');
  });

  // 回归：旧的字符串预处理把 4 空格缩进当成 indented code，列表项里的公式不转换
  it('renders formulas indented inside a list item', () => {
    const html = renderMarkdownToHtml(
      ['- item', '', '    \\[', '    Q,\\quad R', '    \\]'].join('\n'),
    );

    expect(html).toContain('math-display');
    expect(html).not.toContain('\\[');
  });

  it('renders formulas inside a blockquote without swallowing the quote marker', () => {
    const html = renderMarkdownToHtml(['> \\[', '> Q,\\quad R', '> \\]'].join('\n'));

    expect(html).toContain('<blockquote>');
    expect(html).toContain('math-display');
    // `>` 前缀不能被当成公式内容渲染成关系符
    expect(html).toContain('<annotation encoding="application/x-tex">Q,\\quad R</annotation>');
  });

  it('passes LaTeX backslash escapes through verbatim', () => {
    const html = renderMarkdownToHtml(
      ['\\[', '\\begin{aligned}a &= b \\\\ c &= d\\end{aligned}', '\\]'].join('\n'),
    );

    // KaTeX 把原始 TeX 放进 <annotation>，可以直接断言换行符 `\\` 没被吃掉
    expect(html).toContain('b \\\\ c');
    expect(html).not.toContain('katex-error');
    // `\\` 生效才会有两行
    expect(countMatches(html, /<mtr/g)).toBe(2);
  });

  it('keeps bracket delimiters literal inside fenced code, inline code and comments', () => {
    const source = [
      '```ts',
      'const inline = "\\(E=mc^2\\)";',
      '```',
      '',
      '`\\(inline\\)`',
      '',
      '<!-- \\(comment\\) -->',
    ].join('\n');

    const html = renderMarkdownToHtml(source);

    expect(html).not.toContain('katex');
    expect(html).toContain('E=mc^2');
  });

  // CommonMark 里行内的 <code> 不阻止 markdown 解析（`<code>*a*</code>` 也会出斜体），
  // $ 公式在里面同样会渲染，这里保持两种分隔符行为一致
  it('treats raw inline <code> the same way dollar math does', () => {
    expect(renderMarkdownToHtml('<code>\\(E=mc^2\\)</code>')).toContain('math-inline');
    expect(renderMarkdownToHtml('<code>$E=mc^2$</code>')).toContain('math-inline');
  });

  // 公式内容一律回原文取，所以内部这些「像 markdown 语法」的写法不会破坏公式
  it('renders formulas whose body looks like inline markdown', () => {
    expect(renderMarkdownToHtml('\\[a_{i:j}\\]')).toContain('math-display');
    expect(renderMarkdownToHtml('\\[a ~b~ c\\]')).toContain('math-display');
    expect(renderMarkdownToHtml('\\[[a](b)\\]')).toContain('math-display');
    expect(renderMarkdownToHtml('\\(a_{i:j}\\)')).toContain('math-inline');
  });

  it('keeps an escaped \\\\[ literal instead of treating it as a formula', () => {
    const html = renderMarkdownToHtml(['\\\\[', 'Q,\\quad R', '\\\\]'].join('\n'));

    expect(html).not.toContain('katex');
  });

  it('does not let a formula span across block boundaries', () => {
    const html = renderMarkdownToHtml('\\[a\n\nb\\]');

    expect(html).not.toContain('katex');
  });

  it('does not treat a multi-line \\(...\\) as inline math', () => {
    const html = renderMarkdownToHtml('前 \\(a+\nb\\) 后');

    expect(html).not.toContain('katex');
  });

  it('still renders dollar delimiters', () => {
    const inline = renderMarkdownToHtml('行内 $E=mc^2$ 结束');
    const block = renderMarkdownToHtml('$$\n\\int_0^1 x^2 dx\n$$');

    expect(inline).toContain('math-inline');
    expect(block).toContain('math-display');
  });
});

describe('markdown sanitization', () => {
  it('strips inline styles from raw HTML through the website markdown renderer', () => {
    const html = renderMarkdownToHtml(
      '<span style="background:url(https://attacker.invalid/leak)">红字</span>',
    );

    expect(html).toContain('<span>红字</span>');
    expect(html).not.toContain('style=');
  });

  it('strips executable tags, handlers, iframes and unsafe URLs', () => {
    const html = renderMarkdownToHtml(
      '<script>alert(1)</script><img src="javascript:alert(2)" onerror="alert(3)"><iframe srcdoc="<script>alert(4)</script>"></iframe>',
    );

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<iframe');
  });

  it('keeps KaTeX output while dropping author CSS', () => {
    const html = renderMarkdownToHtml('\\[E=mc^2\\]');

    expect(html).toContain('<math');
    expect(html).toContain('style="height:');
  });
});

// website 与 admin 各留一份拷贝（沿用仓库既有约定），这里防止两份实现漂移
describe('bracketMath copies stay in sync', () => {
  it('website and admin share a byte-identical implementation', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const websiteCopy = readFileSync(`${here}../components/Markdown/bracketMath.ts`, 'utf8');
    const adminCopy = readFileSync(
      `${here}../../admin/src/components/Editor/plugins/bracketMath.ts`,
      'utf8',
    );

    expect(adminCopy).toBe(websiteCopy);
  });
});
