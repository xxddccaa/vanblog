import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';

describe('website markdown sanitization', () => {
  it('removes author CSS without stripping trusted KaTeX layout output', () => {
    const html = renderMarkdownToHtml(
      '<span style="position:fixed;background:url(https://attacker.invalid/x)">text</span> $E=mc^2$',
    );

    expect(html).not.toContain('position:fixed');
    expect(html).not.toContain('attacker.invalid');
    expect(html).toContain('<math');
    expect(html).toContain('style="height:');
  });
});
