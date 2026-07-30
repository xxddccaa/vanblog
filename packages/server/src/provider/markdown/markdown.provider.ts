import { Injectable, Logger } from '@nestjs/common';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import taskLists from 'markdown-it-task-lists';
import mk from 'markdown-it-katex';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import abbr from 'markdown-it-abbr';
import multimdTable from 'markdown-it-multimd-table';
import { normalizeMathDelimiters } from './normalizeMathDelimiters';

const DIAGRAM_LANGUAGES = new Set([
  'plantuml', 'puml', 'graphviz', 'dot', 'viz', 'd2',
  'wavedrom', 'vegalite', 'vega-lite', 'ditaa', 'nomnoml',
  'svgbob', 'bytefield', 'c4plantuml', 'erd',
  'blockdiag', 'seqdiag', 'actdiag', 'nwdiag',
]);

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
        if (DIAGRAM_LANGUAGES.has(lang)) {
          return `<div class="vb-diagram-placeholder" data-type="${lang}"><pre><code>${this.md.utils.escapeHtml(str)}</code></pre></div>`;
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
      .use(mk, {
        strict: false,
        throwOnError: false,
      })
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
    return this.md.render(normalizeMathDelimiters(content));
  }

  async renderMarkdownWithDiagrams(content: string): Promise<string> {
    let html = this.renderMarkdown(content);

    const krokiUrl = process.env.VANBLOG_KROKI_URL;
    if (!krokiUrl) return html;

    const placeholderRegex =
      /<div class="vb-diagram-placeholder" data-type="([^"]+)"><pre><code>([^<]*)<\/code><\/pre><\/div>/g;

    const matches = [...html.matchAll(placeholderRegex)];
    for (const match of matches) {
      const [fullMatch, type, escapedSource] = match;
      const source = this.unescapeHtml(escapedSource);
      const krokiType = type === 'dot' ? 'graphviz' : type;

      try {
        const res = await fetch(`${krokiUrl}/${krokiType}/svg`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: source,
        });
        if (res.ok) {
          const svg = await res.text();
          html = html.replace(
            fullMatch,
            `<div class="vb-diagram-container" data-diagram-type="${type}">${svg}</div>`,
          );
        }
      } catch {
        // Leave placeholder if Kroki unavailable
      }
    }

    return html;
  }

  private unescapeHtml(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  getDescription(content: string) {
    return content.split('<!-- more -->')[0];
  }
}
