import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { MARKDOWN_THEME_DEFAULTS } from '../utils/markdownTheme';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const readTheme = (fileName: string) => read(`../public/markdown-themes/${fileName}`);

// Every theme the admin selector offers, plus the website defaults and the plain preset pair.
const selectableThemeFiles = () => {
  const selectorSource = read('../../admin/src/components/MarkdownThemeSelector/index.tsx');
  const files = new Set<string>([
    'vanblog-plain-light-only.css',
    'vanblog-plain-dark-only.css',
    ...Object.values(MARKDOWN_THEME_DEFAULTS).map((url) => url.split('/').pop()!),
  ]);
  const presetPattern = /(?:value|markdownDarkThemePreset): '\/markdown-themes\/([\w-]+\.css)'/g;
  let match: RegExpExecArray | null;
  while ((match = presetPattern.exec(selectorSource)) !== null) {
    files.add(match[1]);
  }
  return Array.from(files).sort();
};

// Collect a theme's own rules plus those of the local themes it @imports, in cascade order.
const collectRules = (fileName: string, seen = new Set<string>()): postcss.Rule[] => {
  if (seen.has(fileName)) return [];
  seen.add(fileName);
  const rules: postcss.Rule[] = [];
  postcss.parse(readTheme(fileName)).each((node) => {
    if (node.type === 'atrule' && node.name === 'import') {
      const imported = node.params.match(/\.\/([\w-]+\.css)/)?.[1];
      if (imported) rules.push(...collectRules(imported, seen));
      return;
    }
    if (node.type === 'rule') {
      rules.push(node);
    } else if (node.type === 'atrule') {
      node.walkRules((rule) => {
        rules.push(rule);
      });
    }
  });
  return rules;
};

// Resolve a font-size to px, with em/rem against the 16px markdown body and root.
const toPx = (value: string) => {
  const match = value.trim().match(/^([\d.]+)(px|em|rem|%)$/);
  if (!match) return Number.NaN;
  const amount = Number(match[1]);
  if (match[2] === 'px') return amount;
  if (match[2] === '%') return (amount / 100) * 16;
  return amount * 16;
};

const fontSizesFor = (rules: postcss.Rule[], selectorPattern: RegExp) => {
  const sizes: number[] = [];
  for (const rule of rules) {
    if (!rule.selectors.some((selector) => selectorPattern.test(selector))) continue;
    rule.walkDecls('font-size', (declaration) => {
      sizes.push(toPx(declaration.value));
    });
  }
  return sizes;
};

describe('markdown theme typography', () => {
  it('gives the markdown body its own 16px size instead of the 14px mobile wrapper', () => {
    const sizes: string[] = [];
    postcss.parse(read('../styles/github-markdown.css')).walkRules('.markdown-body', (rule) => {
      rule.walkDecls('font-size', (declaration) => {
        sizes.push(declaration.value);
      });
    });
    expect(sizes).toEqual(['16px']);
  });

  it('keeps the plain dark body text at the same 16px/1.75 rhythm as the light themes', () => {
    const fonts: string[] = [];
    postcss.parse(readTheme('vanblog-plain-dark-only.css')).walkRules('html.dark .markdown-body', (rule) => {
      rule.walkDecls('font', (declaration) => {
        fonts.push(declaration.value);
      });
    });
    expect(fonts).toHaveLength(1);
    expect(fonts[0].startsWith('16px/1.75 ')).toBe(true);
  });

  it.each([
    ['vanblog-plain-light-only.css', 'html:not(.dark)'],
    ['vanblog-plain-dark-only.css', 'html.dark'],
  ])('keeps %s headings on the compact 28/24/20/18/16px scale', (fileName, scope) => {
    const headingSizes: Record<string, string> = {};
    postcss.parse(readTheme(fileName)).walkDecls('font-size', (declaration) => {
      const rule = declaration.parent as postcss.Rule;
      for (const selector of rule.selectors) {
        if (!selector.startsWith(`${scope} .markdown-body h`)) continue;
        const heading = selector.slice(`${scope} .markdown-body `.length);
        if (/^h[1-6]$/.test(heading)) headingSizes[heading] = declaration.value;
      }
    });
    expect(headingSizes).toEqual({
      h1: '1.75em',
      h2: '1.5em',
      h3: '1.25em',
      h4: '1.125em',
      h5: '1em',
      h6: '1em',
    });
  });

  it('finds every selectable theme file', () => {
    const files = selectableThemeFiles();
    expect(files.length).toBeGreaterThan(40);
    for (const fileName of files) {
      expect(() => readTheme(fileName)).not.toThrow();
    }
  });

  it.each(selectableThemeFiles())('%s never sets body text below 16px', (fileName) => {
    const sizes = fontSizesFor(
      collectRules(fileName),
      /\.markdown-body(\s+(p|li|ul|ol|blockquote))?$/,
    );
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(16);
    }
  });

  it.each(selectableThemeFiles())('%s keeps h1 at or below 28.8px', (fileName) => {
    const sizes = fontSizesFor(collectRules(fileName), /\.markdown-body\s+h1$/);
    for (const size of sizes) {
      expect(size).not.toBeNaN();
      expect(size).toBeLessThanOrEqual(28.8);
    }
  });
});
