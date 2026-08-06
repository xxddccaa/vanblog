import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';

// remark-directive 会把 `:` 紧跟字母的片段（如正文里的 `:GPT`）解析成行内文本指令，
// 若不处理就会被默认处理器渲染成空 <div>，导致原文丢字并意外换行。
// customContainer 插件现在会用源码偏移把这类指令还原为普通文本。
describe('markdown text/leaf directive passthrough', () => {
  it('keeps `:GPT` literal text and does not inject a block element in a list item', () => {
    const source =
      '- **按模型换工具**:GPT 系模型用 `apply_patch` 工具效果好,其他模型用 `edit`+`write`——连"给模型哪个工具"都要按 modelID 分流:';

    const html = renderMarkdownToHtml(source);

    // 关键：原文 :GPT 必须保留
    expect(html).toContain(':GPT');
    // 加粗后紧跟的文本不应被替换成空 div（这正是原 bug 的现象）
    expect(html).not.toContain('<strong>按模型换工具</strong><div></div>');
    expect(html).not.toContain('<div></div>');
    // 结尾冒号原样保留
    expect(html).toContain('分流:');
    // 行内代码仍正常
    expect(html).toContain('>apply_patch</code>');
    expect(html).toContain('>edit</code>');
    expect(html).toContain('>write</code>');
  });

  it('keeps other `:word` inline sequences as plain text', () => {
    const html = renderMarkdownToHtml('参见 :note 或 time :30 的写法');

    expect(html).toContain(':note');
    expect(html).toContain(':30');
    expect(html).not.toContain('<div></div>');
  });

  it('still renders :::info container directives', () => {
    const source = ':::info{title="标题"}\n这是一段说明\n:::';

    const html = renderMarkdownToHtml(source);

    expect(html).toContain('custom-container');
    expect(html).toContain('info');
    expect(html).toContain('这是一段说明');
    // 容器标题应被注入
    expect(html).toContain('标题');
  });
});
