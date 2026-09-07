import type { BytemdPlugin } from 'bytemd';

export type MermaidThemeMode = 'light' | 'dark';

const MERMAID_FONT_FAMILY = 'Trebuchet MS, Verdana, Arial, sans-serif';
const MERMAID_CODE_SELECTOR = 'pre > code.language-mermaid';

const observerRegistry = new WeakMap<HTMLElement, MutationObserver>();
const pendingRenders = new WeakMap<
  HTMLElement,
  {
    theme: MermaidThemeMode;
    isActive: () => boolean;
    promise: Promise<void>;
  }
>();

let mermaidId = 0;
let mermaidLoader: Promise<MermaidRenderer> | null = null;
let renderQueue: Promise<void> = Promise.resolve();

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

export async function renderMermaidBlocks(
  markdownBody: HTMLElement,
  themeMode: MermaidThemeMode,
  isActive: () => boolean = () => true,
) {
  const blocks = markdownBody.querySelectorAll<HTMLElement>(
    `${MERMAID_CODE_SELECTOR}, .bytemd-mermaid[data-vb-mermaid-source]`,
  );
  await Promise.all(
    Array.from(blocks, (block) => {
      const raw = block.matches(MERMAID_CODE_SELECTOR);
      const target = raw ? block.parentElement : block;
      const source = raw ? block.textContent?.trim() : block.dataset.vbMermaidSource;
      if (!target || !source || !isActive()) return;

      const pending = pendingRenders.get(target);
      if (pending?.theme === themeMode && pending.isActive()) return pending.promise;
      // Invalidate an older request even if the existing SVG already has the desired theme.
      pendingRenders.delete(target);
      if (target.dataset.vbMermaidRendered === themeMode) return;

      const request = { theme: themeMode, isActive, promise: Promise.resolve() };
      const canCommit = () =>
        isActive() && markdownBody.contains(target) && pendingRenders.get(target) === request;
      pendingRenders.set(target, request);

      // Mermaid configuration is global, so configure and render each SVG as one queued job.
      request.promise = renderQueue.then(async () => {
        if (!canCommit()) return;
        try {
          const mermaid = await loadMermaid();
          if (!canCommit()) return;
          mermaid.initialize({ ...getMermaidConfig(themeMode), startOnLoad: false });
          const { svg } = await mermaid.render(`vb-mermaid-${Date.now()}-${mermaidId++}`, source);
          if (!canCommit()) return;
          const container = document.createElement('div');
          container.className = 'bytemd-mermaid';
          container.dataset.vbMermaidSource = source;
          container.dataset.vbMermaidRendered = themeMode;
          container.style.lineHeight = 'initial';
          container.innerHTML = svg;
          target.replaceWith(container);
        } catch (error) {
          if (canCommit()) console.error('Website Mermaid render failed', error);
        } finally {
          if (pendingRenders.get(target) === request) pendingRenders.delete(target);
        }
      });
      renderQueue = request.promise;
      return request.promise;
    }),
  );
}

export const customMermaidPlugin = (themeMode: MermaidThemeMode = 'light'): BytemdPlugin => ({
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
