import { describe, expect, it } from 'vitest';
import { getProcessor } from 'bytemd';
import math from '@bytemd/plugin-math-ssr';
import { normalizeMathDelimiters } from '../components/Markdown/normalizeMathDelimiters';

function renderMarkdown(content: string) {
  return String(
    getProcessor({
      plugins: [
        math({
          katexOptions: {
            strict: false,
            throwOnError: false,
          },
        }),
      ],
    }).processSync(content),
  );
}

describe('normalizeMathDelimiters', () => {
  it('converts bracket formulas into dollar delimiters before rendering', () => {
    const normalized = normalizeMathDelimiters('行内公式：\\(E=mc^2\\)\n\n\\[\\int_0^1 x^2 dx\\]');

    expect(normalized).toBe('行内公式：$E=mc^2$\n\n$$\n\\int_0^1 x^2 dx\n$$');
  });

  it('keeps code fences, inline code, raw code tags, and comments untouched', () => {
    const source = [
      '```ts',
      'const inline = "\\(E=mc^2\\)";',
      '```',
      '',
      '`\\(inline\\)`',
      '',
      '<code>\\(raw\\)</code>',
      '',
      '<!-- \\(comment\\) -->',
      '',
      '真正公式：\\(x+y\\)',
    ].join('\n');

    const normalized = normalizeMathDelimiters(source);

    expect(normalized).toContain('const inline = "\\(E=mc^2\\)";');
    expect(normalized).toContain('`\\(inline\\)`');
    expect(normalized).toContain('<code>\\(raw\\)</code>');
    expect(normalized).toContain('<!-- \\(comment\\) -->');
    expect(normalized).toContain('真正公式：$x+y$');
  });

  it('renders normalized bracket formulas through KaTeX', () => {
    const html = renderMarkdown(normalizeMathDelimiters('行内 \\(a+b\\)\n\n\\[c+d\\]'));

    expect(html).toContain('katex');
    expect(html).toContain('math-inline');
    expect(html).toContain('math-display');
    expect(html).not.toContain('\\(');
    expect(html).not.toContain('\\[');
  });
});
