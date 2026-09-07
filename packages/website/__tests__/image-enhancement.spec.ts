// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { enhanceImages, Img } from '../components/Markdown/img';

describe('image enhancement lifecycle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('releases its marker so the same image can be rebound after a theme change', () => {
    document.body.innerHTML = '<img class="img-zoom" src="/logo.svg">';
    const img = document.querySelector('img')!;
    const cleanup = enhanceImages(document.body);
    const duplicateCleanup = enhanceImages(document.body);
    expect(img.classList.contains('medium-zoom-image')).toBe(true);
    duplicateCleanup();
    expect(img.hasAttribute('data-zoomed')).toBe(true);
    cleanup();
    expect(img.classList.contains('medium-zoom-image')).toBe(false);
    expect(img.hasAttribute('data-zoomed')).toBe(false);
    const reboundCleanup = enhanceImages(document.body);
    expect(img.classList.contains('medium-zoom-image')).toBe(true);
    reboundCleanup();
  });

  it('returns cleanup to the client markdown viewer', () => {
    document.body.innerHTML = '<img class="img-zoom" src="/logo.svg">';
    const cleanup = Img().viewerEffect!({ markdownBody: document.body } as any);
    expect(typeof cleanup).toBe('function');
    (cleanup as () => void)();
    expect(document.querySelector('img')!.classList.contains('medium-zoom-image')).toBe(false);
    expect(document.querySelector('img')!.hasAttribute('data-zoomed')).toBe(false);
  });
});
