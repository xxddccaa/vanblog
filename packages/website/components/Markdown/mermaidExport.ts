import type { BytemdPlugin } from 'bytemd';
import toast from 'react-hot-toast';
import type { MermaidThemeMode } from './mermaidTheme';

const MERMAID_CONTAINER_SELECTOR = '.bytemd-mermaid, .mermaid';
const TOOLBAR_CLASS = 'vb-mermaid-toolbar';
const ACTION_BUTTON_CLASS = 'vb-mermaid-action-btn';
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const FALLBACK_BACKGROUND: Record<MermaidThemeMode, string> = {
  light: '#ffffff',
  dark: '#0f172a',
};

const observerRegistry = new WeakMap<HTMLElement, MutationObserver>();

const ICONS = {
  png: `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="12" height="10" rx="2"></rect>
      <circle cx="5.5" cy="6.2" r="1"></circle>
      <path d="M4.5 11l2.2-2.3 1.8 1.8 1.6-1.6 1.4 2.1"></path>
    </svg>
  `,
  svg: `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="4" cy="4" r="1.5"></circle>
      <circle cx="12" cy="4" r="1.5"></circle>
      <circle cx="8" cy="12" r="1.5"></circle>
      <path d="M5.5 4h5"></path>
      <path d="M4.9 5.3l2.2 4.2"></path>
      <path d="M11.1 5.3l-2.2 4.2"></path>
    </svg>
  `,
} as const;

function isTransparentColor(color?: string | null) {
  return !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color === 'rgba(0,0,0,0)';
}

function resolveExportBackground(container: HTMLElement, themeMode: MermaidThemeMode) {
  let current: HTMLElement | null = container.parentElement;

  while (current) {
    const backgroundColor = window.getComputedStyle(current).backgroundColor;
    if (!isTransparentColor(backgroundColor)) {
      return backgroundColor;
    }
    current = current.parentElement;
  }

  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  if (!isTransparentColor(bodyBackground)) {
    return bodyBackground;
  }

  const rootBackground = window.getComputedStyle(document.documentElement).backgroundColor;
  if (!isTransparentColor(rootBackground)) {
    return rootBackground;
  }

  return FALLBACK_BACKGROUND[themeMode];
}

function getToolbar(container: HTMLElement) {
  return Array.from(container.children).find(
    (child) => child instanceof HTMLElement && child.classList.contains(TOOLBAR_CLASS),
  ) as HTMLElement | undefined;
}

function getMermaidSvg(container: HTMLElement) {
  return Array.from(container.children).find(
    (child) => child instanceof SVGSVGElement,
  ) as SVGSVGElement | undefined;
}

function parseSvgLength(value?: string | null) {
  if (!value || value.includes('%')) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getSvgDimensions(svg: SVGSVGElement) {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const widthAttr = parseSvgLength(svg.getAttribute('width'));
  const heightAttr = parseSvgLength(svg.getAttribute('height'));
  if (widthAttr && heightAttr) {
    return { width: widthAttr, height: heightAttr };
  }

  const rect = svg.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }

  return { width: 1200, height: 800 };
}

function serializeSvg(svg: SVGSVGElement, backgroundColor: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = getSvgDimensions(clone);
  const viewBox = clone.getAttribute('viewBox') || `0 0 ${width} ${height}`;
  const styleParts = [clone.getAttribute('style'), `background:${backgroundColor}`, 'max-width:none'];

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', XLINK_NS);
  clone.setAttribute('viewBox', viewBox);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('style', styleParts.filter(Boolean).join(';'));

  return {
    width,
    height,
    markup: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
  };
}

function getDownloadFileName(extension: 'png' | 'svg') {
  return `mermaid-diagram-${Date.now()}.${extension}`;
}

function triggerDownload(download: string, href: string) {
  const anchor = document.createElement('a');
  anchor.download = download;
  anchor.href = href;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = url;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('blob read failed'));
    reader.readAsDataURL(blob);
  });
}

export function downloadMermaidSvg(container: HTMLElement, themeMode: MermaidThemeMode) {
  const svg = getMermaidSvg(container);
  if (!svg) {
    throw new Error('svg not found');
  }

  const backgroundColor = resolveExportBackground(container, themeMode);
  const { markup } = serializeSvg(svg, backgroundColor);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

  triggerDownload(getDownloadFileName('svg'), url);
  window.setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }, 0);
}

export async function downloadMermaidPng(container: HTMLElement, themeMode: MermaidThemeMode) {
  const svg = getMermaidSvg(container);
  if (!svg) {
    throw new Error('svg not found');
  }

  const backgroundColor = resolveExportBackground(container, themeMode);
  const { width, height, markup } = serializeSvg(svg, backgroundColor);
  const svgUrl = await blobToDataUrl(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('canvas context unavailable');
  }

  const image = await loadImage(svgUrl);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  triggerDownload(
    getDownloadFileName('png'),
    canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream'),
  );
}

function handleExportError(format: 'png' | 'svg', error: unknown) {
  console.error(`Mermaid ${format.toUpperCase()} export failed`, error);
  toast.error(format === 'png' ? 'PNG 导出失败，请优先导出 SVG' : 'SVG 导出失败');
}

function createActionButton(format: 'png' | 'svg', onClick: () => void | Promise<void>) {
  const button = document.createElement('button');
  const label = format === 'png' ? '导出 PNG' : '导出 SVG';

  button.type = 'button';
  button.className = ACTION_BUTTON_CLASS;
  button.dataset.format = format;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = ICONS[format];
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await onClick();
    } catch (error) {
      handleExportError(format, error);
    }
  });

  return button;
}

function enhanceMermaidContainer(container: HTMLElement, themeMode: MermaidThemeMode) {
  const svg = getMermaidSvg(container);
  const existingToolbar = getToolbar(container);

  if (!svg) {
    existingToolbar?.remove();
    return;
  }

  if (existingToolbar) {
    return;
  }

  const toolbar = document.createElement('div');
  toolbar.className = TOOLBAR_CLASS;
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Mermaid 导出工具');
  toolbar.appendChild(createActionButton('png', () => downloadMermaidPng(container, themeMode)));
  toolbar.appendChild(createActionButton('svg', () => downloadMermaidSvg(container, themeMode)));
  container.appendChild(toolbar);
}

export function enhanceMermaidExportControls(markdownBody: HTMLElement, themeMode: MermaidThemeMode) {
  markdownBody.querySelectorAll<HTMLElement>(MERMAID_CONTAINER_SELECTOR).forEach((container) => {
    enhanceMermaidContainer(container, themeMode);
  });
}

export function customMermaidExportPlugin(themeMode: MermaidThemeMode): BytemdPlugin {
  return {
    viewerEffect: ({ markdownBody }) => {
      const existingObserver = observerRegistry.get(markdownBody);
      existingObserver?.disconnect();

      enhanceMermaidExportControls(markdownBody, themeMode);

      if (typeof MutationObserver === 'undefined') {
        return;
      }

      const observer = new MutationObserver(() => {
        enhanceMermaidExportControls(markdownBody, themeMode);
      });

      observer.observe(markdownBody, {
        childList: true,
        subtree: true,
      });

      observerRegistry.set(markdownBody, observer);
    },
  };
}
