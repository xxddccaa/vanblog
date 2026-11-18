import { getProcessor } from 'bytemd';
import { describe, expect, it } from 'vitest';
import {
  COMMENT_REMARK_REHYPE_OPTIONS,
  getCommentPreviewPlugins,
  sanitizeCommentSchema,
} from './sanitize';

const render = (markdown: string) =>
  getProcessor({
    plugins: getCommentPreviewPlugins(),
    sanitize: sanitizeCommentSchema,
    remarkRehype: COMMENT_REMARK_REHYPE_OPTIONS,
  })
    .processSync(markdown)
    .toString();

describe('comment markdown preview sanitizing', () => {
  it('renders ordinary markdown', () => {
    const html = render('**bold** _em_ `code`\n\n- [x] done\n\n```js\nlet a = 1;\n```');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>em</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('class="language-js"');
    expect(html).toContain('type="checkbox"');
  });

  it('drops raw html instead of rendering it', () => {
    const html = render(
      'hi <img src=x onerror="alert(1)"> <script>alert(2)</script> <iframe src="https://evil.test"></iframe>\n\n<div onclick="alert(3)">x</div>',
    );
    expect(html).not.toMatch(/<img|<script|<iframe|<div|onerror|onclick/i);
  });

  it('removes dangerous link and image protocols', () => {
    const html = render(
      '[a](javascript:alert(1)) [b](JAVASCRIPT:alert(1)) [c](data:text/html,x) ![d](data:image/png;base64,AAAA) ![e](javascript:alert(1))',
    );
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/data:/i);
  });

  it('keeps http links with a safe target and rel', () => {
    const html = render('[site](https://example.com) ![img](https://example.com/a.png)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('src="https://example.com/a.png"');
  });

  it('allows site-relative images and only whitelisted class names', () => {
    const html = render(
      '![x](/static/img/comment/a.webp)\n\n```js ant-modal-mask\nx\n```\n\n- [ ] task\n\nfootnote[^1]\n\n[^1]: note',
    );
    expect(html).toContain('src="/static/img/comment/a.webp"');
    const classes = Array.from(html.matchAll(/class="([^"]*)"/g)).map((match) => match[1]);
    expect(classes.length).toBeGreaterThan(0);
    for (const value of classes) {
      expect(value).toMatch(/^(language-[\w+-]+|task-list-item|contains-task-list)$/);
    }
    expect(html).not.toContain('ant-modal-mask');
    expect(html).not.toMatch(/\sid="/);
  });
});
