import type { DiagramRenderOptions } from './types';
import { getCachedDiagram, setCachedDiagram } from './cache';

let wavedromModule: any = null;

async function loadWaveDrom() {
  if (!wavedromModule) {
    wavedromModule = await import('wavedrom');
  }
  return wavedromModule;
}

export async function renderWaveDrom(
  source: string,
  opts: DiagramRenderOptions,
): Promise<string> {
  const cached = getCachedDiagram('wavedrom', source, opts.themeMode);
  if (cached) return cached;

  const wd = await loadWaveDrom();
  let parsed: any;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('Invalid WaveDrom JSON');
  }

  const svg = wd.renderAny(0, parsed, wd.waveSkin);
  setCachedDiagram('wavedrom', source, opts.themeMode, svg);
  return svg;
}
