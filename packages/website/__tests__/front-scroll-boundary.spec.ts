import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');
const globalsCss = fs.readFileSync(
  path.join(repoRoot, 'packages/website/styles/globals.css'),
  'utf8',
);

describe('front page scroll boundary styles', () => {
  it('prevents top-edge overscroll from exposing only the configured page background', () => {
    expect(globalsCss).toMatch(/html\s*\{[\s\S]*?overscroll-behavior-y:\s*none;/);
    expect(globalsCss).toMatch(/body\s*\{[\s\S]*?overscroll-behavior-y:\s*none;/);
  });

  it('keeps the background image off the html canvas so overscroll shows only solid color', () => {
    // The <html> element paints the rubber-band overscroll gap. If it carries the
    // background image, scrolling past the top/bottom boundary reveals the image.
    // The image must live on <body> only; <html> keeps a solid background-color so
    // the canvas (and thus the overscroll gap) stays a plain page color.
    const htmlBlock = globalsCss.match(/(^|\n)\s*html\s*\{[\s\S]*?\}/);
    const htmlDarkBlock = globalsCss.match(/html\.dark\s*\{[\s\S]*?\}/);
    expect(htmlBlock).not.toBeNull();
    expect(htmlDarkBlock).not.toBeNull();
    expect(htmlBlock?.[0]).not.toMatch(/background-image/);
    expect(htmlDarkBlock?.[0]).not.toMatch(/background-image/);

    // The body still carries the configured wallpaper in both themes.
    expect(globalsCss).toMatch(/body\s*\{[\s\S]*?background-image:\s*var\(--bg-image\);/);
    expect(globalsCss).toMatch(
      /body\.dark[\s\S]*?\{[\s\S]*?background-image:\s*var\(--bg-image-dark\);/,
    );
  });

  it('keeps the mobile background attachment fallback in place', () => {
    expect(globalsCss).toContain('@media (max-width: 768px), (pointer: coarse), (hover: none)');
    expect(globalsCss).toMatch(/background-attachment:\s*scroll;/);
  });
});
