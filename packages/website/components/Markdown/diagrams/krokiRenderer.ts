import type { DiagramRenderOptions } from './types';
import { getCachedDiagram, setCachedDiagram } from './cache';

export async function renderWithKroki(
  source: string,
  type: string,
  opts: DiagramRenderOptions,
): Promise<string> {
  const cached = getCachedDiagram(type, source, opts.themeMode);
  if (cached) return cached;

  const res = await fetch('/api/public/diagram/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      source,
      format: 'svg',
      themeMode: opts.themeMode,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Render failed' }));
    throw new Error(err.detail || err.message || `Kroki error: ${res.status}`);
  }

  const svg = await res.text();
  setCachedDiagram(type, source, opts.themeMode, svg);
  return svg;
}
