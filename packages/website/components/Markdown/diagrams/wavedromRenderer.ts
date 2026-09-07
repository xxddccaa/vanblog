import type { DiagramRenderOptions } from './types';
import { getCachedDiagram, setCachedDiagram } from './cache';

let wavedromModule: any = null;

const PRESENTATION_ATTRIBUTES = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'font-variant',
  'font-stretch',
  'text-anchor',
  'opacity',
  'color',
]);

function inlineSkinPresentation(markup: string, skinCss: string, dark: boolean) {
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const apply = (element: Element, declarations: CSSStyleDeclaration) => {
    for (let i = 0; i < declarations.length; i++) {
      const property = declarations[i];
      if (PRESENTATION_ATTRIBUTES.has(property)) {
        element.setAttribute(property, declarations.getPropertyValue(property));
      }
    }
  };
  // Keep the library skin as SVG attributes so sanitization can still forbid CSS.
  if (skinCss) {
    const style = document.createElement('style');
    style.media = 'not all';
    style.textContent = skinCss;
    document.head.append(style);
    try {
      Array.from(style.sheet?.cssRules || []).forEach((rule) => {
        if (rule.type !== CSSRule.STYLE_RULE) return;
        const styleRule = rule as CSSStyleRule;
        svg
          .querySelectorAll(styleRule.selectorText)
          .forEach((element) => apply(element, styleRule.style));
      });
    } finally {
      style.remove();
    }
  }
  svg.querySelectorAll('style').forEach((node) => node.remove());
  svg.querySelectorAll<SVGElement>('[style]').forEach((element) => {
    apply(element, element.style);
    element.removeAttribute('style');
  });
  // Expand only local library glyphs; the sanitizer intentionally removes SVG use elements.
  svg.querySelectorAll('use').forEach((use) => {
    const href = use.getAttribute('href') || use.getAttribute('xlink:href');
    const glyph = href?.startsWith('#') ? svg.getElementById(href.slice(1)) : null;
    if (!glyph || glyph.contains(use)) return;
    const group = svg.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const attribute of Array.from(use.attributes)) {
      if (!['href', 'xlink:href', 'x', 'y'].includes(attribute.name)) {
        group.setAttribute(attribute.name, attribute.value);
      }
    }
    if (use.hasAttribute('x') || use.hasAttribute('y')) {
      group.setAttribute(
        'transform',
        `${use.getAttribute('transform') || ''} translate(${use.getAttribute('x') || 0} ${
          use.getAttribute('y') || 0
        })`,
      );
    }
    const clone = glyph.cloneNode(true) as Element;
    clone.removeAttribute('id');
    group.append(clone);
    use.replaceWith(group);
  });
  const background = svg.querySelector('[id^="waves_"] > rect');
  background?.setAttribute('fill', dark ? '#1f2020' : '#ffffff');
  return new XMLSerializer().serializeToString(svg.documentElement);
}

async function loadWaveDrom() {
  if (!wavedromModule) {
    wavedromModule = await import('wavedrom');
  }
  return wavedromModule;
}

export async function renderWaveDrom(source: string, opts: DiagramRenderOptions): Promise<string> {
  const cached = getCachedDiagram('wavedrom', source, opts.themeMode);
  if (cached) return cached;

  const wd = await loadWaveDrom();
  let parsed: any;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('Invalid WaveDrom JSON');
  }

  const skin =
    opts.themeMode === 'dark' ? (await import('wavedrom/skins/dark.js')).default : wd.waveSkin;
  const skinTemplate = skin.default || skin[Object.keys(skin)[0]];
  const skinCss =
    skinTemplate.find((node: unknown) => Array.isArray(node) && node[0] === 'style')?.[2] || '';
  const svg = inlineSkinPresentation(
    wd.onml.stringify(wd.renderAny(0, parsed, skin)),
    skinCss,
    opts.themeMode === 'dark',
  );
  setCachedDiagram('wavedrom', source, opts.themeMode, svg);
  return svg;
}
