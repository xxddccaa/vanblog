import {
  buildCodeBlockSnippet,
  buildCustomContainerSnippet,
  buildImageMarkdown,
  buildLinkSnippet,
  buildMathBlockSnippet,
  buildMoreSnippet,
  buildTaskListSnippet,
  insertTextAtRange,
  resolveEditorEngine,
} from './utils';

describe('MarkdownEditor utils', () => {
  it('resolves editor engine with milkdown as default', () => {
    expect(resolveEditorEngine(null)).toBe('milkdown');
    expect(resolveEditorEngine('invalid')).toBe('milkdown');
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

  it('inserts snippets at the current selection for toolbar actions', () => {
    const source = 'hello world';
    const result = insertTextAtRange(source, { start: 6, end: 11 }, '😊');

    expect(result.value).toBe('hello 😊');
    expect(result.selection).toEqual({ start: 8, end: 8 });
  });
});
