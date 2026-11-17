import { getProcessor } from 'bytemd';
import type { BytemdPlugin } from 'bytemd';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { visit } from 'unist-util-visit';

/**
 * Comment Markdown is anonymous input, so it is rendered with a much smaller
 * surface than articles:
 *
 * - raw HTML is never parsed (`allowDangerousHtml: false`);
 * - no Mermaid, diagram, container or other runtime plugins;
 * - embedded media and active content tags are removed with their children;
 * - only a short allow-list of attributes survives sanitizing, and classes
 *   only where gfm, math and highlighting need them;
 * - links are limited to http/https/mailto, images to http/https or relative
 *   URLs, and every link is marked `nofollow ugc noopener noreferrer`;
 * - KaTeX runs with `trust: false` and bounded size and macro expansion.
 *
 * bytemd sanitizes before running plugin rehype steps, so KaTeX and
 * highlight.js output (trusted, generated markup) is not stripped, while the
 * output policy below is applied last as a second, independent check. It
 * also demotes headings so comments cannot inject entries into the TOC.
 */

export const COMMENT_LINK_REL = 'nofollow ugc noopener noreferrer';

export const COMMENT_REMARK_REHYPE = { allowDangerousHtml: false } as const;

export const COMMENT_KATEX_OPTIONS = {
  trust: false,
  strict: 'ignore',
  throwOnError: false,
  maxSize: 20,
  maxExpand: 1000,
} as const;

const BLOCKED_TAGS = [
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'video',
  'audio',
  'picture',
  'source',
  'track',
  'canvas',
  'svg',
  'math',
  'form',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'base',
  'template',
  'noscript',
  'map',
  'area',
];

const LINK_PROTOCOLS = ['http', 'https', 'mailto'];
const IMAGE_PROTOCOLS = ['http', 'https'];

const CODE_LANGUAGE_CLASS = /^language-[\w+#.-]{1,40}$/;

const COMMENT_ATTRIBUTES: Record<
  string,
  Array<string | [string, ...Array<string | boolean | RegExp>]>
> = {
  a: [
    'href',
    'title',
    'id',
    'dataFootnoteRef',
    'dataFootnoteBackref',
    'ariaDescribedBy',
    'ariaLabel',
  ],
  img: ['src', 'alt', 'title'],
  code: [['className', CODE_LANGUAGE_CLASS]],
  span: [['className', 'math', 'math-inline']],
  div: [['className', 'math', 'math-display']],
  ul: [['className', 'contains-task-list']],
  ol: ['start', ['className', 'contains-task-list']],
  li: ['id', ['className', 'task-list-item']],
  input: [['type', 'checkbox'], ['disabled', true], 'checked'],
  th: ['align'],
  td: ['align'],
  h2: ['id', ['className', 'sr-only']],
  section: ['dataFootnotes', ['className', 'footnotes']],
  '*': [],
};

export function sanitizeCommentSchema(schema: any) {
  const blocked = new Set(BLOCKED_TAGS);
  const tagNames: string[] = Array.isArray(schema?.tagNames) ? schema.tagNames : [];
  const strip: string[] = Array.isArray(schema?.strip) ? schema.strip : [];
  return {
    ...schema,
    tagNames: tagNames.filter((name) => !blocked.has(String(name).toLowerCase())),
    strip: Array.from(new Set([...strip, ...BLOCKED_TAGS])),
    attributes: COMMENT_ATTRIBUTES,
    protocols: {
      href: LINK_PROTOCOLS,
      src: IMAGE_PROTOCOLS,
    },
    required: {
      input: { type: 'checkbox', disabled: true },
    },
    allowComments: false,
    allowDoctypes: false,
  };
}

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z\d+.-]*):/;
// Browsers drop ASCII tab/newline inside URLs ("java\tscript:"), so any
// control character makes a URL unsafe.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * True for relative URLs and absolute URLs whose scheme is allowed.
 * Values arrive already entity-decoded from the hast tree.
 */
export function isSafeCommentUrl(value: unknown, protocols: readonly string[]) {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHARACTERS.test(trimmed) || trimmed.includes('\\')) {
    return false;
  }
  const scheme = SCHEME_PATTERN.exec(trimmed);
  if (!scheme) {
    return true;
  }
  return protocols.includes(scheme[1].toLowerCase());
}

const isExternalHttpUrl = (value: string) => /^(https?:)?\/\//i.test(value.trim());

const HEADING_TAG = /^h[1-6]$/;

const hasClass = (node: any, name: string) => {
  const className = node.properties?.className;
  return Array.isArray(className) ? className.includes(name) : className === name;
};

const commentOutputPolicy = () => (tree: any) => {
  visit(tree, 'element', (node: any, index: number | null, parent: any) => {
    if (HEADING_TAG.test(node.tagName)) {
      // Comment headings must not join the article outline or the TOC scanner,
      // which walks every `.markdown-body h1..h6` on the page.
      if (hasClass(node, 'sr-only')) {
        node.tagName = 'p';
        return;
      }
      node.tagName = 'p';
      node.properties = {};
      node.children = [
        { type: 'element', tagName: 'strong', properties: {}, children: node.children },
      ];
      return;
    }
    if (node.tagName === 'a') {
      const properties = node.properties || (node.properties = {});
      if (properties.href !== undefined && !isSafeCommentUrl(properties.href, LINK_PROTOCOLS)) {
        delete properties.href;
      }
      properties.rel = COMMENT_LINK_REL.split(' ');
      if (typeof properties.href === 'string' && isExternalHttpUrl(properties.href)) {
        properties.target = '_blank';
      } else {
        delete properties.target;
      }
      return;
    }
    if (node.tagName === 'img') {
      const properties = node.properties || {};
      const alt = typeof properties.alt === 'string' ? properties.alt : '';
      if (!isSafeCommentUrl(properties.src, IMAGE_PROTOCOLS)) {
        // Keep the description readable instead of leaving a broken image.
        if (parent && typeof index === 'number') {
          parent.children[index] = { type: 'text', value: alt };
        }
        return;
      }
      const next: Record<string, unknown> = { src: properties.src, alt };
      if (typeof properties.title === 'string') {
        next.title = properties.title;
      }
      next.loading = 'lazy';
      next.decoding = 'async';
      next.referrerPolicy = 'no-referrer';
      node.properties = next;
    }
  });
};

function commentOutputPolicyPlugin(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(commentOutputPolicy),
  };
}

export function createCommentMarkdownPlugins(): BytemdPlugin[] {
  return [
    gfm(),
    highlight(),
    math({ katexOptions: { ...COMMENT_KATEX_OPTIONS } }),
    commentOutputPolicyPlugin(),
  ];
}

/** Shared by the viewer, the preview tab and tests. Plugins are stateless. */
export const commentMarkdownPlugins = createCommentMarkdownPlugins();

export function renderCommentMarkdownToHtml(content: string) {
  return String(
    getProcessor({
      plugins: commentMarkdownPlugins,
      remarkRehype: { ...COMMENT_REMARK_REHYPE },
      sanitize: sanitizeCommentSchema,
    }).processSync(content || ''),
  );
}
