// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';
import { enhanceCodeBlocks } from '../components/Markdown/codeBlock';

describe('code block controls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts wrapped, hides short-block toggles, and preserves user state on rebind', () => {
    document.body.innerHTML = renderMarkdownToHtml(
      '```bash\necho short\n```\n\n```bash\n' +
        Array.from({ length: 24 }, (_, i) => `echo ${i}`).join('\n') +
        '\n```',
    );
    const cleanup = enhanceCodeBlocks(document.body);
    const blocks = document.querySelectorAll<HTMLElement>('.code-block-wrapper');
    const shortToggle = blocks[0].querySelector<HTMLElement>('.code-toggle-btn')!;
    const wrap = blocks[0].querySelector<HTMLElement>('.code-wrap-btn')!;
    const content = blocks[0].querySelector<HTMLElement>('.code-content-wrapper')!;
    const longContent = blocks[1].querySelector<HTMLElement>('.code-content-wrapper')!;
    expect(shortToggle.hidden).toBe(true);
    expect(content.classList.contains('code-wrap-enabled')).toBe(true);
    expect(wrap.title).toBe('取消自动换行');
    wrap.click();
    expect(content.classList.contains('code-wrap-enabled')).toBe(false);
    expect(wrap.title).toBe('自动换行');
    blocks[1].querySelector<HTMLElement>('.code-toggle-btn')!.click();
    expect(longContent.classList.contains('code-collapsed')).toBe(false);
    cleanup();
    const cleanupAgain = enhanceCodeBlocks(document.body);
    expect(content.classList.contains('code-wrap-enabled')).toBe(false);
    expect(longContent.classList.contains('code-collapsed')).toBe(false);
    wrap.click();
    expect(content.classList.contains('code-wrap-enabled')).toBe(true);
    cleanupAgain();
    wrap.click();
    expect(content.classList.contains('code-wrap-enabled')).toBe(true);
  });
});
