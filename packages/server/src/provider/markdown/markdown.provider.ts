import { Injectable, Logger } from '@nestjs/common';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import sanitizeHtml from 'sanitize-html';
import taskLists from 'markdown-it-task-lists';
import markdownItKatex from '@vscode/markdown-it-katex';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import abbr from 'markdown-it-abbr';
import multimdTable from 'markdown-it-multimd-table';
import { bracketMath } from './bracketMath';

const KATEX_MATHML_TAGS = [
  'math',
  'semantics',
  'annotation',
  'mrow',
  'mi',
  'mo',
  'mn',
  'mtext',
  'mspace',
  'ms',
  'mfrac',
  'msqrt',
  'mroot',
  'msub',
  'msup',
  'msubsup',
  'munder',
  'mover',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'mpadded',
  'menclose',
  'mstyle',
];
const KATEX_LENGTH = /^-?(?:0|[0-9]*\.?[0-9]+)(?:em|ex|px|pt|%)?$/;

const MARKDOWN_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'input',
    'mark',
    'sub',
    'sup',
    ...KATEX_MATHML_TAGS,
  ],
  allowedAttributes: {
    '*': ['class', 'id', 'title', 'aria-*'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    input: ['type', 'checked', 'disabled'],
    div: ['class'],
    code: ['class'],
    span: ['style'],
    math: ['xmlns', 'display'],
    annotation: ['encoding'],
    mstyle: ['mathcolor', 'mathbackground', 'mathvariant'],
    mo: ['fence', 'separator', 'stretchy', 'symmetric', 'largeop', 'movablelimits'],
    mspace: ['width', 'height', 'depth'],
    mtd: ['columnalign', 'rowalign'],
    mtable: ['columnalign', 'rowalign', 'columnspacing', 'rowspacing'],
  },
  // KaTeX emits a small set of layout declarations. Keep only inert values
  // required for formula positioning instead of restoring arbitrary CSS.
  allowedStyles: {
    span: {
      height: [KATEX_LENGTH],
      width: [KATEX_LENGTH],
      'min-width': [KATEX_LENGTH],
      top: [KATEX_LENGTH],
      left: [KATEX_LENGTH],
      'margin-left': [KATEX_LENGTH],
      'margin-right': [KATEX_LENGTH],
      'margin-top': [KATEX_LENGTH],
      'padding-left': [KATEX_LENGTH],
      'vertical-align': [KATEX_LENGTH],
      'border-bottom-width': [KATEX_LENGTH],
      'border-width': [KATEX_LENGTH],
      'border-style': [/^solid$/],
      position: [/^relative$/],
      color: [/^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\(\s*[0-9.%\s,]+\))$/i],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowProtocolRelative: false,
};

function sanitizeMarkdownHtml(html: string) {
  return sanitizeHtml(html, MARKDOWN_SANITIZE_OPTIONS);
}

@Injectable()
export class MarkdownProvider {
  logger = new Logger(MarkdownProvider.name);
  md: MarkdownIt = null;
  constructor() {
    this.md = new MarkdownIt({
      html: true,
      breaks: true,
      linkify: false,
      highlight: (str, lang) => {
        if (lang == 'mermaid') {
          return `<div class="mermaid">${str}</div>`;
        }
        if (lang && hljs.getLanguage(lang)) {
          try {
            return (
              '<pre class="hljs" style="background: #f3f3f3; padding: 8px;><code>' +
              hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
              '</code></pre>'
            );
          } catch (e) {
            console.log(e);
          }
          return (
            '<pre class="hljs" style="background: #f3f3f3;padding: 8px;"><code>' +
            this.md.utils.escapeHtml(str) +
            '</code></pre>'
          );
        }
      },
    })
      .use(taskLists)
      .use(markdownItKatex, {
        strict: false,
        throwOnError: false,
      })
      // 必须在 katex 插件之后，复用它注册的 math_block / math_inline 渲染器
      .use(bracketMath)
      .use(footnote)
      .use(mark)
      .use(sub)
      .use(sup)
      .use(abbr)
      .use(multimdTable, {
        multiline: true,
        rowspan: true,
        headerless: false,
      });
  }
  renderMarkdown(content: string) {
    return sanitizeMarkdownHtml(this.md.render(content));
  }

  getDescription(content: string) {
    return content.split('<!-- more -->')[0];
  }
}
