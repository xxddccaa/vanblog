import { buildArticleMarkdownPreview, buildArticlePreview } from './articlePreview';

describe('buildArticlePreview (纯文本，供搜索索引使用)', () => {
  it('剥离 Markdown，输出纯文本', () => {
    const preview = buildArticlePreview('# 标题\n\n这是 **粗体** 和 [链接](https://a.com) 与 `code`。');
    expect(preview).toBe('标题 这是 粗体 和 链接 与 code。');
    expect(preview).not.toContain('**');
    expect(preview).not.toContain('[');
    expect(preview).not.toContain('`');
  });

  it('超长时截断并补省略号', () => {
    const preview = buildArticlePreview('一'.repeat(500));
    expect(preview.endsWith('...')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(223);
  });
});

describe('buildArticleMarkdownPreview (保留 Markdown，供首页卡片渲染)', () => {
  it('短文原样保留粗体/链接/图片语法', () => {
    const content = '这是 **粗体**、[链接](https://a.com) 和 ![图](https://a.com/x.png)。';
    const preview = buildArticleMarkdownPreview(content);
    expect(preview).toContain('**粗体**');
    expect(preview).toContain('[链接](https://a.com)');
    expect(preview).toContain('![图](https://a.com/x.png)');
  });

  it('遇到 <!-- more --> 只取其之前，且不加省略号', () => {
    const content = '开头 **一段**。\n\n<!-- more -->\n\n后面还有很多内容……';
    const preview = buildArticleMarkdownPreview(content);
    expect(preview).toBe('开头 **一段**。');
    expect(preview).not.toContain('后面还有很多内容');
    expect(preview.endsWith('...')).toBe(false);
  });

  it('截断时不切断代码围栏，且末尾补省略号', () => {
    const content = [
      'a',
      '```js',
      'const a = 1;',
      'const b = 2;',
      'const c = 3;',
      '```',
      '围栏后的正文。',
    ].join('\n');
    const preview = buildArticleMarkdownPreview(content, 10);
    // 代码围栏必须成对闭合
    const fenceCount = (preview.match(/```/g) || []).length;
    expect(fenceCount % 2).toBe(0);
    expect(fenceCount).toBeGreaterThanOrEqual(2);
    expect(preview).toContain('const a = 1;');
    expect(preview).not.toContain('围栏后的正文。');
    expect(preview.endsWith('...')).toBe(true);
  });

  it('源码本身围栏未闭合时，结果也会补齐闭合', () => {
    const content = '```js\ncode line\nmore';
    const preview = buildArticleMarkdownPreview(content, 1);
    const fenceCount = (preview.match(/```/g) || []).length;
    expect(fenceCount % 2).toBe(0);
    expect(preview.trimEnd().endsWith('```')).toBe(true);
  });

  it('普通长文按行边界截断且不切断行内构造', () => {
    const line = '这一行里有 [某链接](https://example.com/very/long/path) 结束。';
    const content = Array.from({ length: 10 }, () => line).join('\n');
    const preview = buildArticleMarkdownPreview(content, 30);
    // 保留的每个链接都应完整（成对的 ]( 与 ) ）
    const openParens = (preview.match(/\]\(/g) || []).length;
    const links = (preview.match(/\[某链接\]\(https:\/\/example\.com\/very\/long\/path\)/g) || []).length;
    expect(links).toBe(openParens);
    expect(preview.endsWith('...')).toBe(true);
  });
});
