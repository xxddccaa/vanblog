import type { DiagramThemeMode } from './types';
import { ALL_DIAGRAM_LANGUAGES, KROKI_LANGUAGES, WAVEDROM_LANGUAGES } from './types';
import { renderWithKroki } from './krokiRenderer';
import { renderWaveDrom } from './wavedromRenderer';
import { sanitizeDiagramSvg } from '../sanitize';

const pendingRenders = new WeakMap<
  HTMLElement,
  {
    theme: DiagramThemeMode;
    isActive: () => boolean;
    promise: Promise<void>;
  }
>();

export async function renderDiagramBlocks(
  container: HTMLElement,
  themeMode: DiagramThemeMode,
  isActive: () => boolean = () => true,
): Promise<void> {
  const selector = ALL_DIAGRAM_LANGUAGES.map((lang) => `pre > code.language-${lang}`).join(', ');

  const codeElements = container.querySelectorAll<HTMLElement>(
    `${selector}, .vb-diagram-container[data-diagram-source]`,
  );
  if (!codeElements.length) return;

  const renderPromises: Promise<void>[] = [];

  codeElements.forEach((codeEl) => {
    const raw = codeEl.matches(selector);
    const target = raw ? codeEl.parentElement : codeEl;
    const language = raw ? extractLanguage(codeEl) : codeEl.dataset.diagramType;
    const source = (raw ? codeEl.textContent : codeEl.dataset.diagramSource) || '';
    if (!target || !language || !source.trim() || !isActive()) return;

    const pending = pendingRenders.get(target);
    if (pending?.theme === themeMode && pending.isActive()) {
      renderPromises.push(pending.promise);
      return;
    }
    pendingRenders.delete(target);
    if (target.dataset.vbDiagramRendered === themeMode) return;

    const request = { theme: themeMode, isActive, promise: Promise.resolve() };
    const canCommit = () =>
      isActive() && container.contains(target) && pendingRenders.get(target) === request;
    pendingRenders.set(target, request);
    request.promise = renderSingleDiagram(target, language, source, themeMode, canCommit).finally(
      () => {
        if (pendingRenders.get(target) === request) pendingRenders.delete(target);
      },
    );
    renderPromises.push(request.promise);
  });

  await Promise.allSettled(renderPromises);
}

async function renderSingleDiagram(
  preEl: HTMLElement,
  language: string,
  source: string,
  themeMode: DiagramThemeMode,
  canCommit: () => boolean,
): Promise<void> {
  try {
    let svg: string;

    if (WAVEDROM_LANGUAGES.includes(language)) {
      svg = await renderWaveDrom(source, { themeMode });
    } else if (KROKI_LANGUAGES.includes(language)) {
      svg = await renderWithKroki(source, language, { themeMode });
    } else {
      return;
    }

    if (!canCommit()) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'vb-diagram-container';
    wrapper.setAttribute('data-diagram-type', language);
    wrapper.setAttribute('data-diagram-source', source);
    wrapper.setAttribute('data-vb-diagram-rendered', themeMode);
    wrapper.innerHTML = sanitizeDiagramSvg(svg);

    addExportToolbar(wrapper, themeMode);

    preEl.replaceWith(wrapper);
  } catch (error) {
    if (!canCommit()) return;
    const errDiv = document.createElement('div');
    errDiv.className = 'vb-diagram-error';
    errDiv.textContent = `Diagram render error: ${(error as Error).message}`;
    preEl.after(errDiv);
  }
}

function addExportToolbar(container: HTMLElement, themeMode: DiagramThemeMode): void {
  const toolbar = document.createElement('div');
  toolbar.className = 'vb-diagram-toolbar';

  const svgBtn = document.createElement('button');
  svgBtn.className = 'vb-diagram-action-btn';
  svgBtn.textContent = 'SVG';
  svgBtn.title = '下载 SVG';
  svgBtn.addEventListener('click', () => downloadSvg(container, themeMode));

  const pngBtn = document.createElement('button');
  pngBtn.className = 'vb-diagram-action-btn';
  pngBtn.textContent = 'PNG';
  pngBtn.title = '下载 PNG';
  pngBtn.addEventListener('click', () => downloadPng(container, themeMode));

  toolbar.appendChild(svgBtn);
  toolbar.appendChild(pngBtn);
  container.appendChild(toolbar);
}

function downloadSvg(container: HTMLElement, themeMode: DiagramThemeMode): void {
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const clone = svgEl.cloneNode(true) as SVGElement;
  const bg = themeMode === 'dark' ? '#0f172a' : '#ffffff';
  clone.setAttribute('style', `background-color: ${bg}`);

  const serializer = new XMLSerializer();
  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone);

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, 'diagram.svg');
}

function downloadPng(container: HTMLElement, themeMode: DiagramThemeMode): void {
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const clone = svgEl.cloneNode(true) as SVGElement;
  const bg = themeMode === 'dark' ? '#0f172a' : '#ffffff';
  clone.setAttribute('style', `background-color: ${bg}`);

  const bbox = svgEl.getBoundingClientRect();
  const width = bbox.width * 2;
  const height = bbox.height * 2;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, 'diagram.png');
    }, 'image/png');
  };
  img.src = dataUrl;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
