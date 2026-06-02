import {
  buildCodeBlockSnippet,
  buildCustomContainerSnippet,
  buildImageMarkdown,
  buildLinkSnippet,
  buildMathBlockSnippet,
  buildMoreSnippet,
  buildTextColorSnippet,
  buildTaskListSnippet,
  insertTextAtRange,
  normalizeTextColor,
  resolveEditorEngine,
  TEXT_COLOR_PRESETS,
} from './utils';

describe('MarkdownEditor utils', () => {
  it('resolves editor engine with bytemd as default', () => {
    expect(resolveEditorEngine(null)).toBe('bytemd');
    expect(resolveEditorEngine('invalid')).toBe('bytemd');
    expect(resolveEditorEngine('bytemd')).toBe('bytemd');
  });

  it('builds toolbar insertion snippets for more, container, code block and emoji insertion', () => {
    expect(buildMoreSnippet()).toBe('<!-- more -->\n');
    expect(buildCustomContainerSnippet('info')).toBe(
      ':::info{title="相关信息"}\n相关信息\n:::',
    );
    expect(buildCodeBlockSnippet('mermaid')).toBe('```mermaid\n\n```');
    expect(buildTaskListSnippet()).toBe('- [ ] 待办事项');
  });

  it('keeps markdown syntax stable for math, raw html and image snippets', () => {
    expect(buildMathBlockSnippet()).toBe('$$\n\n$$');
    expect(buildImageMarkdown('https://img.test/demo.png', 'demo', '示例图')).toBe(
      '![demo](https://img.test/demo.png "示例图")',
    );
    expect(buildLinkSnippet('iframe', 'https://example.com/embed')).toBe(
      '[iframe](https://example.com/embed)',
    );
  });

  it('normalizes text colors to preset or hex values only', () => {
    expect(normalizeTextColor('')).toBe(TEXT_COLOR_PRESETS[0]);
    expect(normalizeTextColor(' red ')).toBe(TEXT_COLOR_PRESETS[0]);
    expect(normalizeTextColor('#FF4D4F')).toBe('#ff4d4f');
    expect(normalizeTextColor('#12ab34')).toBe('#12ab34');
    expect(normalizeTextColor('var(--danger)')).toBe(TEXT_COLOR_PRESETS[0]);
  });

  it('builds span wrappers for colorized inline text', () => {
    expect(buildTextColorSnippet('希望我进行什么技术尝试可以留言~', '#ff4d4f')).toBe(
      '<span style="color:#ff4d4f">希望我进行什么技术尝试可以留言~</span>',
    );
  });

  it('inserts snippets at the current selection for toolbar actions', () => {
    const source = 'hello world';
    const result = insertTextAtRange(source, { start: 6, end: 11 }, '😊');

    expect(result.value).toBe('hello 😊');
    expect(result.selection).toEqual({ start: 8, end: 8 });
  });
});
