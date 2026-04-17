// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  customMermaidExportPlugin,
  downloadMermaidPng,
  downloadMermaidSvg,
  enhanceMermaidExportControls,
} from '../components/Markdown/mermaidExport';

const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

class MockImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(_value: string) {
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

function createMermaidFixture(withSvg = true) {
  const markdownBody = document.createElement('div');
  markdownBody.className = 'markdown-body';
  markdownBody.style.backgroundColor = 'rgb(250, 250, 250)';

  const container = document.createElement('div');
  container.className = 'bytemd-mermaid';
  markdownBody.appendChild(container);

  if (withSvg) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 80');
    container.appendChild(svg);
  }

  document.body.appendChild(markdownBody);
  return { markdownBody, container };
}

describe('mermaid export toolbar', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalImage = globalThis.Image;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mermaid-export');
    URL.revokeObjectURL = vi.fn();
    globalThis.Image = MockImage as unknown as typeof Image;
    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn() as unknown as CanvasRenderingContext2D['fillRect'],
      drawImage: vi.fn() as unknown as CanvasRenderingContext2D['drawImage'],
    } as unknown as CanvasRenderingContext2D;

    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => mockContext,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/png;base64,exported',
    ) as typeof HTMLCanvasElement.prototype.toDataURL;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    globalThis.Image = originalImage;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    toastError.mockReset();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('injects one PNG button and one SVG button for each rendered Mermaid chart', () => {
    const { markdownBody, container } = createMermaidFixture(true);

    enhanceMermaidExportControls(markdownBody, 'light');
    enhanceMermaidExportControls(markdownBody, 'light');

    expect(container.querySelectorAll('.vb-mermaid-toolbar')).toHaveLength(1);
    expect(container.querySelector('[data-format="png"]')).toBeTruthy();
    expect(container.querySelector('[data-format="svg"]')).toBeTruthy();
  });

  it('does not inject toolbar before Mermaid renders the svg, but observer enhances it afterwards', async () => {
    const { markdownBody, container } = createMermaidFixture(false);
    const plugin = customMermaidExportPlugin('dark');

    plugin.viewerEffect?.({ markdownBody } as never);
    expect(container.querySelector('.vb-mermaid-toolbar')).toBeNull();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 48');
    container.appendChild(svg);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelectorAll('.vb-mermaid-toolbar')).toHaveLength(1);
  });

  it('downloads SVG from the rendered Mermaid svg', () => {
    const { container } = createMermaidFixture(true);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadMermaidSvg(container, 'light');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('downloads PNG by rasterizing the rendered Mermaid svg onto a canvas', async () => {
    const { container } = createMermaidFixture(true);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadMermaidPng(container, 'dark');

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/png');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the toolbar hidden when Mermaid has not rendered an svg', () => {
    const { markdownBody, container } = createMermaidFixture(false);

    enhanceMermaidExportControls(markdownBody, 'light');

    expect(container.querySelector('.vb-mermaid-toolbar')).toBeNull();
  });
});
