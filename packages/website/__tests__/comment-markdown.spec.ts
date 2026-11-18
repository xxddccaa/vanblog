import { describe, expect, it } from 'vitest';
import {
  COMMENT_KATEX_OPTIONS,
  isSafeCommentUrl,
  renderCommentMarkdownToHtml,
  sanitizeCommentSchema,
} from '../components/CommentMarkdown/schema';

const render = (markdown: string) => renderCommentMarkdownToHtml(markdown);

const hrefs = (html: string) =>
  Array.from(html.matchAll(/href="([^"]*)"/g)).map((match) => match[1]);
const srcs = (html: string) => Array.from(html.matchAll(/src="([^"]*)"/g)).map((match) => match[1]);

describe('comment markdown sanitizing', () => {
  it('drops javascript: and data: link targets in every spelling', () => {
    const html = render(
      [
        '[a](javascript:alert(1))',
        '[b](JAVASCRIPT:alert(1))',
        '[c](data:text/html;base64,PHNjcmlwdD4=)',
        '[d](java&#x09;script:alert(1))',
        '[e](&#106;avascript:alert(1))',
        '[f](vbscript:msgbox(1))',
        '<javascript:alert(1)>',
      ].join(' '),
    );

    expect(hrefs(html)).toEqual([]);
    // Visible text may still mention the URL; no attribute may carry it.
    expect(html).not.toMatch(/(href|src)="[^"]*(javascript|vbscript|data):/i);
    expect(html).toContain('>a</a>');
  });

  it('keeps http, https, mailto and relative links with ugc rel attributes', () => {
    const html = render(
      '[web](https://example.com/a) [plain](http://example.org) [mail](mailto:me@example.com) [post](/post/1) <https://auto.example>',
    );

    expect(hrefs(html)).toEqual([
      'https://example.com/a',
      'http://example.org',
      'mailto:me@example.com',
      '/post/1',
      'https://auto.example',
    ]);
    const anchors = html.match(/<a [^>]*>/g) || [];
    expect(anchors).toHaveLength(5);
    for (const anchor of anchors) {
      expect(anchor).toContain('rel="nofollow ugc noopener noreferrer"');
    }
    expect(html).toContain(
      'href="https://example.com/a" rel="nofollow ugc noopener noreferrer" target="_blank"',
    );
    expect(html).not.toMatch(/href="mailto:me@example.com"[^>]*target=/);
    expect(html).not.toMatch(/href="\/post\/1"[^>]*target=/);
  });

  it('drops data: and javascript: images but keeps their description', () => {
    const html = render(
      '![pixel](data:image/png;base64,AAAA) ![evil](javascript:alert(1)) ![svg](data:image/svg+xml;utf8,%3Csvg%20onload%3Dalert(1)%3E)',
    );

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    expect(html).not.toMatch(/(href|src)="[^"]*(javascript|data):/i);
    expect(srcs(html)).toEqual([]);
    expect(html).toContain('pixel');
    expect(html).toContain('evil');
  });

  it('keeps http(s) and site-relative images with only safe attributes', () => {
    const html = render(
      '![local](/static/img/comment/abc.webp "title") ![remote](https://img.example/a.png)',
    );

    expect(srcs(html)).toEqual(['/static/img/comment/abc.webp', 'https://img.example/a.png']);
    const images = html.match(/<img [^>]*>/g) || [];
    expect(images).toHaveLength(2);
    for (const image of images) {
      const attributes = Array.from(image.matchAll(/\s([a-z-]+)=/g)).map((match) => match[1]);
      for (const attribute of attributes) {
        expect(['src', 'alt', 'title', 'loading', 'decoding', 'referrerpolicy']).toContain(
          attribute,
        );
      }
    }
    expect(html).toContain('referrerpolicy="no-referrer"');
  });

  it('never renders raw HTML', () => {
    const html = render(
      [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<iframe src="https://evil.example"></iframe>',
        '<video src="https://evil.example/v.mp4" autoplay></video>',
        '<audio src="https://evil.example/a.mp3"></audio>',
        '<a href="https://example.com" onclick="alert(1)">raw link</a>',
        '<style>body{display:none}</style>',
        '<svg onload=alert(1)></svg>',
        '<details open ontoggle=alert(1)>x</details>',
      ].join('\n\n'),
    );

    expect(html).not.toMatch(/<(script|img|iframe|video|audio|style|svg|details|a)\b/i);
    expect(html).not.toMatch(/on(error|click|load|toggle)=/i);
  });

  it('blocks style and class injection', () => {
    const html = render(
      [
        '<span style="position:fixed;inset:0" class="fixed inset-0 z-50">overlay</span>',
        '<div class="toast">fake toast</div>',
        '```js fixed inset-0',
        'const a = 1;',
        '```',
        '',
        '```x" onclick="alert(1)',
        'code',
        '```',
      ].join('\n'),
    );

    expect(html).not.toContain('position:fixed');
    expect(html).not.toContain('inset-0');
    expect(html).not.toContain('toast');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('style=');
    const classes = Array.from(html.matchAll(/class="([^"]*)"/g)).flatMap((match) =>
      match[1].split(/\s+/),
    );
    for (const name of classes.filter(Boolean)) {
      expect(name).toMatch(/^(hljs.*|language-[\w+#.-]+)$/);
    }
  });

  it('keeps KaTeX output but disables trusted commands', () => {
    const html = render(
      [
        '$\\href{javascript:alert(1)}{click}$',
        '$\\url{javascript:alert(2)}$',
        '$\\includegraphics{https://evil.example/a.png}$',
        '$\\htmlClass{fixed}{x}$',
        '$\\htmlStyle{position:fixed}{y}$',
        '$\\htmlData{foo=bar}{z}$',
        '$E=mc^2$',
      ].join(' '),
    );

    expect(html).toContain('class="katex"');
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/<img\b/);
    expect(html).not.toContain('href="javascript');
    expect(html).not.toContain('class="fixed"');
    // The TeX source is echoed as text; it must never become a style attribute.
    expect(html).not.toMatch(/style="[^"]*position:\s*fixed/);
    expect(html).not.toContain('data-foo');
  });

  it('configures KaTeX with bounded size and expansion', () => {
    expect(COMMENT_KATEX_OPTIONS.trust).toBe(false);
    expect(COMMENT_KATEX_OPTIONS.maxSize).toBeGreaterThan(0);
    expect(COMMENT_KATEX_OPTIONS.maxExpand).toBeGreaterThan(0);

    const started = Date.now();
    const html = render('$\\def\\x{\\x\\x}\\x$');
    expect(Date.now() - started).toBeLessThan(5000);
    expect(html).not.toContain('<script');
  });

  it('demotes headings so comments cannot join the article outline', () => {
    const html = render('# Title\n\n## Sub\n\nnote[^1]\n\n[^1]: text');
    expect(html).not.toMatch(/<h[1-6]\b/);
    expect(html).toContain('<p><strong>Title</strong></p>');
    expect(html).toContain('<p><strong>Sub</strong></p>');
    expect(html).toContain('class="sr-only"');
  });

  it('does not run diagram plugins', () => {
    const html = render('```mermaid\ngraph TD; A-->B\n```');
    expect(html).toContain('<pre><code');
    expect(html).not.toContain('bytemd-mermaid');
    expect(html).not.toContain('<svg');
  });

  it('still renders ordinary Markdown', () => {
    const html = render(
      '**bold** _it_ ~~del~~ `code`\n\n> quote\n\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst a = 1;\n```',
    );
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<del>del</del>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<table>');
    expect(html).toContain('hljs language-js');
  });
});

describe('comment sanitize schema', () => {
  it('removes media and active tags and strips their content', () => {
    const schema = sanitizeCommentSchema({
      tagNames: ['p', 'a', 'img', 'iframe', 'video', 'audio', 'picture', 'source', 'details'],
      strip: ['script'],
      attributes: { '*': ['className', 'style'] },
      protocols: { src: ['http', 'https', 'data'] },
    });

    expect(schema.tagNames).toEqual(['p', 'a', 'img', 'details']);
    for (const tag of ['script', 'iframe', 'video', 'audio', 'picture', 'source', 'svg', 'style']) {
      expect(schema.strip).toContain(tag);
    }
    expect(schema.attributes['*']).toEqual([]);
    expect(schema.attributes.img).toEqual(['src', 'alt', 'title']);
    expect(schema.protocols.src).toEqual(['http', 'https']);
    expect(schema.protocols.href).toEqual(['http', 'https', 'mailto']);
  });

  it('classifies URLs by scheme', () => {
    expect(isSafeCommentUrl('https://example.com', ['http', 'https'])).toBe(true);
    expect(isSafeCommentUrl('/static/a.webp', ['http', 'https'])).toBe(true);
    expect(isSafeCommentUrl('#user-content-fn-1', ['http'])).toBe(true);
    expect(isSafeCommentUrl('javascript:alert(1)', ['http', 'https'])).toBe(false);
    expect(isSafeCommentUrl(' JavaScript:alert(1)', ['http', 'https'])).toBe(false);
    expect(isSafeCommentUrl('java\tscript:alert(1)', ['http', 'https'])).toBe(false);
    expect(isSafeCommentUrl('data:image/png;base64,AAAA', ['http', 'https'])).toBe(false);
    expect(isSafeCommentUrl('', ['http'])).toBe(false);
    expect(isSafeCommentUrl(undefined, ['http'])).toBe(false);
  });
});
