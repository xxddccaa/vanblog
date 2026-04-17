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

  return {
    startOnLoad: true,
    darkMode: resolvedThemeMode === 'dark',
    theme: resolvedThemeMode === 'dark' ? 'dark' : 'default',
    fontFamily: MERMAID_FONT_FAMILY,
  };
}

async function loadMermaid() {
  if (!mermaidLoader) {
    mermaidLoader = import('mermaid').then((module) => module.default as MermaidRenderer);
  }

  return mermaidLoader;
}

async function renderMermaidBlocks(markdownBody: HTMLElement, themeMode: MermaidThemeMode) {
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
