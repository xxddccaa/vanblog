// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('shared markdown code styles', () => {
  afterEach(() => {
    document.documentElement.className = '';
    document.body.innerHTML = '';
  });

  it('ships base and code styles with both markdown renderers', () => {
    for (const component of ['Markdown', 'RenderedMarkdown']) {
      expect(read(`../components/${component}/index.tsx`)).toContain(
        "import '../../styles/markdown-content.css'",
      );
    }

    const imports: string[] = [];
    postcss.parse(read('../styles/markdown-content.css')).walkAtRules('import', (rule) => {
      imports.push(rule.params);
    });
    expect(imports).toEqual([
      "'katex/dist/katex.min.css'",
      "'./github-markdown.css'",
      "'./custom-container.css'",
      "'./code-light.css'",
      "'./code-dark.css'",
      "'./zoom.css'",
      "'./markdown-runtime.css'",
    ]);
  });

  it('limits the plain dark code chip to inline code, including raw HTML', () => {
    document.documentElement.className = 'dark';
    document.body.innerHTML = `<div class="markdown-body">${renderMarkdownToHtml(
      [
        'Inline `example` and <tt>legacy</tt>.',
        '',
        '```bash',
        'for task in current next; do',
        '  echo "$task"',
        'done',
        '```',
        '',
        '```',
        'plain block',
        '```',
        '',
        '<pre><code>raw block</code></pre>',
      ].join('\n'),
    )}</div>`;

    const chipSelectors: string[] = [];
    postcss
      .parse(read('../public/markdown-themes/vanblog-plain-dark-only.css'))
      .walkRules((rule) => {
        if (rule.selector.includes('code')) chipSelectors.push(rule.selector);
      });
    expect(chipSelectors).toHaveLength(1);
    const selector = chipSelectors[0];
    expect(document.querySelector('p code')?.matches(selector)).toBe(true);
    expect(document.querySelector('p tt')?.matches(selector)).toBe(true);
    const blockCodes = document.querySelectorAll('pre code');
    expect(blockCodes).toHaveLength(3);
    blockCodes.forEach((code) => expect(code.matches(selector)).toBe(false));

    // Also cover editor-style wrappers that are not nested under pre.
    for (const wrapper of ['code-block-wrapper', 'code-content-wrapper']) {
      document
        .querySelector('.markdown-body')!
        .insertAdjacentHTML('beforeend', `<div class="${wrapper}"><code>wrapped</code></div>`);
      const code = document.querySelector(`.markdown-body > .${wrapper} code`)!;
      expect(code.matches(selector)).toBe(false);
    }
  });

  it('excludes hidden controls from the hotfix display override in both themes', () => {
    const displaySelectors: string[] = [];
    postcss.parse(read('../public/markdown-themes/vanblog-theme-hotfix.css')).walkRules((rule) => {
      if (!rule.selector.includes('.code-toggle-btn')) return;
      rule.walkDecls('display', (declaration) => {
        if (declaration.important && declaration.value !== 'none')
          displaySelectors.push(rule.selector);
      });
    });
    expect(displaySelectors.length).toBeGreaterThan(0);
    for (const theme of ['dark', 'light']) {
      document.documentElement.className = theme;
      document.body.innerHTML = `<main data-vb-markdown-${theme}-theme-id="graphite"><div class="markdown-body"><div class="code-block-wrapper"><div class="header-right"><div class="code-toggle-btn" hidden></div><div class="code-toggle-btn"></div></div></div></div></main>`;
      const hidden = document.querySelector('.code-toggle-btn[hidden]')!;
      const visible = document.querySelector('.code-toggle-btn:not([hidden])')!;
      displaySelectors.forEach((selector) => {
        expect(hidden.matches(selector)).toBe(false);
        expect(visible.matches(selector)).toBe(true);
      });
    }
  });
});
