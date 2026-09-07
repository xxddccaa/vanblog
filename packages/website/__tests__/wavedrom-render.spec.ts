// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as wavedrom from 'wavedrom';
import { renderWaveDrom } from '../components/Markdown/diagrams/wavedromRenderer';
import { sanitizeDiagramSvg } from '../components/Markdown/sanitize';

describe('real WaveDrom output', () => {
  it('only preserves marker styles that reference a marker in the same SVG', async () => {
    const stringify = vi.spyOn(wavedrom.onml, 'stringify').mockReturnValueOnce(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs><marker id="arrow"/><path id="not-marker"/></defs>
        <path id="local" style="marker-end:url('#arrow')"/>
        <path id="external" style="marker-end:url(https://example.com/arrow.svg#arrow)"/>
        <path id="missing" style="marker-start:url(#missing)"/>
        <path id="wrong-type" style="marker-end:url(#not-marker)"/>
      </svg>
    `);
    try {
      const source = JSON.stringify({ signal: [{ name: 'marker validation', wave: 'p...' }] });
      const result = await renderWaveDrom(source, { themeMode: 'light' });
      const svg = new DOMParser().parseFromString(sanitizeDiagramSvg(result), 'image/svg+xml');
      expect(svg.getElementById('local')?.getAttribute('marker-end')).toBe('url(#arrow)');
      for (const id of ['external', 'missing', 'wrong-type']) {
        const path = svg.getElementById(id)!;
        expect(path.hasAttribute('marker-start')).toBe(false);
        expect(path.hasAttribute('marker-end')).toBe(false);
      }
      expect(svg.querySelector('style, [style]')).toBeNull();
    } finally {
      stringify.mockRestore();
    }
  });

  it.each(['light', 'dark'] as const)(
    'preserves edge arrows and endpoints in %s mode',
    async (themeMode) => {
      for (const [edge, start, end] of [
        ['a->b', null, 'arrowhead'],
        ['a<->b', 'arrowtail', 'arrowhead'],
        ['a+b', 'tee', 'tee'],
      ]) {
        const source = JSON.stringify({
          signal: [
            { name: 'a', wave: '01..', node: '.a..' },
            { name: 'b', wave: '0.1.', node: '..b.' },
          ],
          edge: [edge],
        });
        const result = await renderWaveDrom(source, { themeMode });
        const svg = new DOMParser().parseFromString(sanitizeDiagramSvg(result), 'image/svg+xml');
        const arc = svg.getElementById('gmark_a_b')!;
        expect(arc).toBeTruthy();
        expect(arc.getAttribute('marker-start')).toBe(start ? `url(#${start})` : null);
        expect(arc.getAttribute('marker-end')).toBe(`url(#${end})`);
        for (const id of [start, end].filter(Boolean)) {
          expect(svg.getElementById(id!)?.localName).toBe('marker');
        }
        expect(svg.querySelector('style, [style]')).toBeNull();
      }
    },
  );

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
