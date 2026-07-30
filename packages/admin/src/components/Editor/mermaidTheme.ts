import type { BytemdPlugin } from 'bytemd';

export type MermaidThemeMode = 'light' | 'dark';

const MERMAID_FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const MERMAID_CODE_SELECTOR = 'pre > code.language-mermaid';

let mermaidId = 0;
let mermaidModule: any = null;

export function normalizeMermaidThemeMode(themeMode?: string): MermaidThemeMode {
  return themeMode === 'dark' ? 'dark' : 'light';
}

export function getMermaidConfig(themeMode: MermaidThemeMode = 'light') {
  if (themeMode === 'dark') {
    return {
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1e3a5f',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#4a9eff',
        lineColor: '#94a3b8',
        secondaryColor: '#1e293b',
        tertiaryColor: '#334155',
        noteBkgColor: '#1e293b',
        noteTextColor: '#e2e8f0',
        actorTextColor: '#e2e8f0',
        actorBorder: '#4a9eff',
        actorBkg: '#1e293b',
        signalColor: '#e2e8f0',
        labelBoxBkgColor: '#1e293b',
        labelTextColor: '#e2e8f0',
      },
      fontFamily: MERMAID_FONT_FAMILY,
    };
  }

  return {
    startOnLoad: false,
    theme: 'default',
    themeVariables: {
      primaryColor: '#dbeafe',
      primaryTextColor: '#1e293b',
      primaryBorderColor: '#3b82f6',
      lineColor: '#64748b',
      secondaryColor: '#f1f5f9',
      tertiaryColor: '#e2e8f0',
      noteBkgColor: '#fef3c7',
      noteTextColor: '#1e293b',
      noteBorderColor: '#f59e0b',
    },
    fontFamily: MERMAID_FONT_FAMILY,
  };
}

async function loadMermaid() {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default;
  }
  return mermaidModule;
}

export const customMermaidPlugin = (
  themeMode: MermaidThemeMode = 'light',
): BytemdPlugin => ({
  viewerEffect({ markdownBody }) {
    (async () => {
      const els = markdownBody.querySelectorAll<HTMLElement>(MERMAID_CODE_SELECTOR);
      if (els.length === 0) return;

      const m = await loadMermaid();
      m.initialize(getMermaidConfig(themeMode));

      for (const el of Array.from(els)) {
        const pre = el.parentElement;
        if (!pre || pre.dataset.vbMermaidPending === 'true') continue;

        const source = el.textContent?.trim();
        if (!source) continue;

        pre.dataset.vbMermaidPending = 'true';

        try {
          const { svg } = await m.render(`vb-admin-mermaid-${Date.now()}-${mermaidId++}`, source);
          const container = document.createElement('div');
          container.className = 'bytemd-mermaid';
          container.style.lineHeight = 'initial';
          container.innerHTML = svg;
          pre.replaceWith(container);
        } catch (error) {
          console.error('Admin mermaid render failed', error);
          delete pre.dataset.vbMermaidPending;
        }
      }
    })();
  },
  actions: [
    {
      title: 'Mermaid',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 48 48"><path stroke="currentColor" stroke-linejoin="round" stroke-width="4" d="M17 6h14v9H17zM6 33h14v9H6zM28 33h14v9H28z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M24 16v8M13 33v-9h22v9"/></svg>',
      cheatsheet: '```mermaid',
      handler: {
        type: 'dropdown',
        actions: [
          {
            title: '流程图',
            handler: {
              type: 'action',
              click({ editor, appendBlock, codemirror }: any) {
                const code = 'graph TD\n    Start --> Stop';
                const { line } = appendBlock('```mermaid\n' + code + '\n```');
                editor.setSelection(codemirror.Pos(line + 1, 0), codemirror.Pos(line + 1 + code.split('\n').length));
                editor.focus();
              },
            },
          },
          {
            title: '时序图',
            handler: {
              type: 'action',
              click({ editor, appendBlock, codemirror }: any) {
                const code = 'sequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi';
                const { line } = appendBlock('```mermaid\n' + code + '\n```');
                editor.setSelection(codemirror.Pos(line + 1, 0), codemirror.Pos(line + 1 + code.split('\n').length));
                editor.focus();
              },
            },
          },
          {
            title: '饼图',
            handler: {
              type: 'action',
              click({ editor, appendBlock, codemirror }: any) {
                const code = 'pie title 示例\n    "A" : 40\n    "B" : 35\n    "C" : 25';
                const { line } = appendBlock('```mermaid\n' + code + '\n```');
                editor.setSelection(codemirror.Pos(line + 1, 0), codemirror.Pos(line + 1 + code.split('\n').length));
                editor.focus();
              },
            },
          },
        ],
      },
    },
  ],
});
