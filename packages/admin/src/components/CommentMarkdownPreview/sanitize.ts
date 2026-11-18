import gfm from '@bytemd/plugin-gfm';
import type { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';

/**
 * Strict rendering rules for untrusted comment Markdown, matching the rules
 * the website applies to comments:
 * - raw HTML is never parsed (remark-rehype runs without allowDangerousHtml),
 * - only the tags plain Markdown and GFM produce survive sanitizing,
 * - links and images accept http(s) or site-relative URLs only,
 * - class names are limited to code languages and GFM task lists.
 */
export const COMMENT_REMARK_REHYPE_OPTIONS = { allowDangerousHtml: false };

const COMMENT_ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'input',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

export function sanitizeCommentSchema(schema: any) {
  return {
    ...schema,
    strip: ['script', 'style', 'iframe', 'object', 'embed', 'audio', 'video', 'svg', 'math'],
    tagNames: COMMENT_ALLOWED_TAGS,
    protocols: {
      href: ['http', 'https'],
      src: ['http', 'https'],
    },
    attributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      code: [['className', /^language-[\w+-]+$/]],
      input: [['type', 'checkbox'], ['disabled', true], 'checked'],
      li: [['className', 'task-list-item']],
      ul: [['className', 'contains-task-list']],
      ol: [['className', 'contains-task-list']],
      td: [['align', 'left', 'right', 'center']],
      th: [['align', 'left', 'right', 'center']],
      '*': [],
    },
    required: {
      input: { type: 'checkbox', disabled: true },
    },
  };
}

const externalLinkAttributes = () => (tree: any) => {
  visit(tree, (node: any) => {
    if (node.type === 'element' && node.tagName === 'a') {
      node.properties = {
        ...node.properties,
        target: '_blank',
        rel: ['noopener', 'noreferrer', 'nofollow'],
      };
    }
    if (node.type === 'element' && node.tagName === 'img') {
      node.properties = {
        ...node.properties,
        loading: 'lazy',
        referrerPolicy: 'no-referrer',
      };
    }
  });
};

/** Runs after sanitizing: forces safe link targets on visitor links. */
export function commentLinkPlugin(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(externalLinkAttributes),
  };
}

export function getCommentPreviewPlugins(): BytemdPlugin[] {
  return [gfm(), commentLinkPlugin()];
}
