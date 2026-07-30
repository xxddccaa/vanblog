import type { BytemdPlugin } from 'bytemd';

export type MermaidThemeMode = 'light' | 'dark';

const MERMAID_FONT_FAMILY = 'Trebuchet MS, Verdana, Arial, sans-serif';
const MERMAID_CODE_SELECTOR = 'pre > code.language-mermaid';

const observerRegistry = new WeakMap<HTMLElement, MutationObserver>();

let mermaidId = 0;
let mermaidLoader: Promise<MermaidRenderer> | null = null;

type MermaidRenderer = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    text: string,
  ) => Promise<{
    svg: string;
  }>;
};

export function normalizeMermaidThemeMode(themeMode?: string): MermaidThemeMode {
  return themeMode === 'dark' ? 'dark' : 'light';
}

// Follow Mermaid's official light/dark themes instead of forcing one custom
// base palette across both site themes.
export function getMermaidConfig(themeMode: MermaidThemeMode = 'light') {
  const resolvedThemeMode = normalizeMermaidThemeMode(themeMode);

  if (resolvedThemeMode === 'dark') {
    return {
      startOnLoad: true,
      darkMode: true,
      theme: 'dark' as const,
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
    startOnLoad: true,
    darkMode: false,
    theme: 'default' as const,
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
  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then((module) => module.default as MermaidRenderer);
  }

  return mermaidLoader;
}

export async function renderMermaidBlocks(markdownBody: HTMLElement, themeMode: MermaidThemeMode) {
  const mermaidBlocks = Array.from(
    markdownBody.querySelectorAll<HTMLElement>(MERMAID_CODE_SELECTOR),
  ).filter((codeBlock) => {
    const pre = codeBlock.parentElement;
    return pre instanceof HTMLElement && pre.dataset.vbMermaidPending !== 'true';
  });

  if (mermaidBlocks.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();
  mermaid.initialize({
    ...getMermaidConfig(themeMode),
    startOnLoad: false,
  });

  for (const codeBlock of mermaidBlocks) {
    const pre = codeBlock.parentElement;
    if (!(pre instanceof HTMLElement)) {
      continue;
    }

    const source = codeBlock.textContent?.trim();
    if (!source) {
      continue;
    }

    pre.dataset.vbMermaidPending = 'true';

    try {
      const { svg } = await mermaid.render(`vb-mermaid-${Date.now()}-${mermaidId++}`, source);
      const container = document.createElement('div');

      container.className = 'bytemd-mermaid';
      container.style.lineHeight = 'initial';
      container.innerHTML = svg;
      pre.replaceWith(container);
    } catch (error) {
      console.error('Website Mermaid render failed', error);
    } finally {
      delete pre.dataset.vbMermaidPending;
    }
  }
}

export const customMermaidPlugin = (
  themeMode: MermaidThemeMode = 'light',
): BytemdPlugin => ({
  viewerEffect({ markdownBody }) {
    const existingObserver = observerRegistry.get(markdownBody);
    existingObserver?.disconnect();

    void renderMermaidBlocks(markdownBody, themeMode);

    const observer = new MutationObserver(() => {
      void renderMermaidBlocks(markdownBody, themeMode);
    });

    observer.observe(markdownBody, {
      childList: true,
      subtree: true,
    });

    observerRegistry.set(markdownBody, observer);
  },
});
