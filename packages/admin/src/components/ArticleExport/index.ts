import { getArticleById } from '@/services/van-blog/api';
import { message } from 'antd';

const PRINT_STYLES = `
@media print {
  body { margin: 0; padding: 20mm; }
  .markdown-body { max-width: 100%; padding: 0; }
  .vb-diagram-container { break-inside: avoid; }
  .code-block-wrapper { break-inside: avoid; }
  pre { white-space: pre-wrap; word-break: break-all; }
  .vb-mermaid-toolbar, .vb-diagram-toolbar { display: none !important; }
}
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
`;

export async function exportArticlePdf(articleId: number) {
  try {
    const { data: article } = await getArticleById(articleId);
    if (!article) {
      message.error('文章不存在');
      return;
    }

    const title = article.title || '文章';
    const content = article.content || '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('无法打开新窗口，请检查浏览器弹窗设置');
      return;
    }

    const themeMode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

    const githubMarkdownCss = await fetchCssText('/admin/github-markdown.css');
    const codeCss = themeMode === 'dark'
      ? await fetchCssText('/admin/code-dark.css').catch(() => '')
      : await fetchCssText('/admin/code-light.css').catch(() => '');

    printWindow.document.write(`<!DOCTYPE html>
<html class="${themeMode}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - PDF Export</title>
  <style>${githubMarkdownCss}</style>
  <style>${codeCss}</style>
  <style>${PRINT_STYLES}</style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
</head>
<body data-theme="${themeMode}">
  <div class="markdown-body" id="article-content">
    <h1>${escapeHtml(title)}</h1>
    <div id="md-render-target"></div>
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: false, theme: '${themeMode === 'dark' ? 'dark' : 'default'}' });

    async function renderMermaidBlocks() {
      const blocks = document.querySelectorAll('pre > code.language-mermaid');
      for (const block of blocks) {
        const source = block.textContent;
        try {
          const { svg } = await mermaid.render('mermaid-' + Math.random().toString(36).slice(2), source);
          const div = document.createElement('div');
          div.className = 'bytemd-mermaid';
          div.innerHTML = svg;
          block.parentElement.replaceWith(div);
        } catch(e) { console.warn('Mermaid render failed:', e); }
      }
    }

    async function renderDiagrams() {
      const DIAGRAM_LANGS = ['plantuml','puml','graphviz','dot','viz','d2','wavedrom','vegalite','vega-lite','ditaa','nomnoml'];
      for (const lang of DIAGRAM_LANGS) {
        const blocks = document.querySelectorAll('pre > code.language-' + lang);
        for (const block of blocks) {
          const source = block.textContent;
          try {
            const res = await fetch('/api/public/diagram/render', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ type: lang, source, format: 'svg' })
            });
            if (res.ok) {
              const svg = await res.text();
              const div = document.createElement('div');
              div.className = 'vb-diagram-container';
              div.innerHTML = svg;
              block.parentElement.replaceWith(div);
            }
          } catch(e) { console.warn('Diagram render failed:', e); }
        }
      }
    }

    await renderMermaidBlocks();
    await renderDiagrams();
    setTimeout(() => window.print(), 500);
  <\/script>
</body>
</html>`);

    // Render markdown content into the target
    const { renderMarkdownForExport } = await import('./renderForExport');
    const html = renderMarkdownForExport(content);
    const target = printWindow.document.getElementById('md-render-target');
    if (target) {
      target.innerHTML = html;
    }

    printWindow.document.close();
  } catch (error) {
    message.error('导出失败: ' + (error as Error).message);
  }
}

async function fetchCssText(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (res.ok) return res.text();
  } catch {}
  return '';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
