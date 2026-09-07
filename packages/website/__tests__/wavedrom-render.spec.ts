// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderWaveDrom } from '../components/Markdown/diagrams/wavedromRenderer';
import { sanitizeDiagramSvg } from '../components/Markdown/sanitize';

describe('real WaveDrom output', () => {
  it('serializes valid SVG with distinct light and dark skins through sanitization', async () => {
    const source = JSON.stringify({ signal: [{ name: 'clk', wave: 'p...' }] });
    const light = await renderWaveDrom(source, { themeMode: 'light' });
    const dark = await renderWaveDrom(source, { themeMode: 'dark' });
    expect(dark).not.toBe(light);
    const colors: string[] = [];
    for (const result of [light, dark]) {
      expect(typeof result).toBe('string');
      expect(result).not.toContain('[object Object]');
      const svg = new DOMParser().parseFromString(sanitizeDiagramSvg(result), 'image/svg+xml');
      expect(svg.querySelector('parsererror')).toBeNull();
      expect(svg.documentElement.tagName).toBe('svg');
      expect(svg.querySelector('path')).toBeTruthy();
      expect(svg.querySelector('[id^="wavelane_draw_"] path')).toBeTruthy();
      expect(svg.querySelector('use')).toBeNull();
      expect(svg.querySelector('style, [style]')).toBeNull();
      colors.push(svg.querySelector('path.s1')!.getAttribute('stroke')!);
      expect(svg.documentElement.textContent).toContain('clk');
    }
    expect(colors[0]).toBe('rgb(0, 0, 0)');
    expect(colors[1]).toBe('rgb(255, 255, 255)');
    expect(await renderWaveDrom(source, { themeMode: 'dark' })).toBe(dark);
  });
});
