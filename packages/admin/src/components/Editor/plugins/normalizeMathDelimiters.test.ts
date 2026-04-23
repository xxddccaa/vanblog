import { normalizeMathDelimiters } from './normalizeMathDelimiters';

describe('normalizeMathDelimiters', () => {
  it('converts bracket formulas without mutating other markdown content', () => {
    const source = ['正文 \\(E=mc^2\\)', '', '\\[\\int_0^1 x^2 dx\\]', '', '```md', '\\(keep\\)', '```'].join('\n');

    expect(normalizeMathDelimiters(source)).toBe([
      '正文 $E=mc^2$',
      '',
      '$$',
      '\\int_0^1 x^2 dx',
      '$$',
      '',
      '```md',
      '\\(keep\\)',
      '```',
    ].join('\n'));
  });

  it('leaves inline code and raw code tags unchanged', () => {
    const source = '`\\(keep\\)` <code>\\(also-keep\\)</code> 真公式 \\(x\\)';

    expect(normalizeMathDelimiters(source)).toBe('`\\(keep\\)` <code>\\(also-keep\\)</code> 真公式 $x$');
  });
});
