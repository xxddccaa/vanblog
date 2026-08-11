import type { BytemdPlugin } from 'bytemd';
import type { DiagramThemeMode } from './types';
import { ALL_DIAGRAM_LANGUAGES, KROKI_LANGUAGES, WAVEDROM_LANGUAGES } from './types';
import { sanitizeDiagramSvg } from '../../sanitize';

export function diagramPlugin(themeMode: DiagramThemeMode): BytemdPlugin {
  return {
    viewerEffect: ({ markdownBody }) => {
      renderDiagramBlocks(markdownBody, themeMode);
    },
  };
}

async function renderDiagramBlocks(
  container: HTMLElement,
  themeMode: DiagramThemeMode,
): Promise<void> {
  const selector = ALL_DIAGRAM_LANGUAGES.map(
    (lang) => `pre > code.language-${lang}`,
  ).join(', ');

  const codeElements = container.querySelectorAll(selector);
  if (!codeElements.length) return;

  for (const codeEl of Array.from(codeElements)) {
    const preEl = codeEl.parentElement;
    if (!preEl || preEl.getAttribute('data-vb-diagram-rendered') === themeMode) continue;

    const language = extractLanguage(codeEl);
    if (!language) continue;

    const source = codeEl.textContent || '';
    if (!source.trim()) continue;

    try {
      let svg: string;

      if (WAVEDROM_LANGUAGES.includes(language)) {
        const { renderAny, waveSkin } = await import('wavedrom');
        const parsed = JSON.parse(source);
        svg = renderAny(0, parsed, waveSkin);
      } else if (KROKI_LANGUAGES.includes(language)) {
        svg = await renderWithKroki(source, language, themeMode);
      } else {
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'vb-diagram-container';
      wrapper.setAttribute('data-diagram-type', language);
      wrapper.setAttribute('data-diagram-source', source);
      wrapper.setAttribute('data-vb-diagram-rendered', themeMode);
      wrapper.innerHTML = sanitizeDiagramSvg(svg);
      preEl.replaceWith(wrapper);
    } catch (error) {
      const errDiv = document.createElement('div');
      errDiv.className = 'vb-diagram-error';
      errDiv.textContent = `Diagram error: ${(error as Error).message}`;
      preEl.after(errDiv);
    }
  }
}

async function renderWithKroki(
  source: string,
  type: string,
  themeMode: DiagramThemeMode,
): Promise<string> {
  const res = await fetch('/api/public/diagram/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, source, format: 'svg', themeMode }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Render failed' }));
    throw new Error(err.detail || err.message || `Kroki error: ${res.status}`);
  }

  return res.text();
}

function extractLanguage(codeEl: Element): string | null {
  const classes = codeEl.className.split(/\s+/);
  for (const cls of classes) {
    const match = cls.match(/^language-(.+)$/);
    if (match && ALL_DIAGRAM_LANGUAGES.includes(match[1])) {
      return match[1];
    }
  }
  return null;
}

export { ALL_DIAGRAM_LANGUAGES } from './types';
export type { DiagramThemeMode } from './types';
