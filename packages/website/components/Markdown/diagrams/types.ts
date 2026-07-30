export type DiagramThemeMode = 'light' | 'dark';

export interface DiagramRenderOptions {
  themeMode: DiagramThemeMode;
}

export interface DiagramRenderer {
  languages: string[];
  render(source: string, opts: DiagramRenderOptions): Promise<string>;
}

export const KROKI_LANGUAGES = [
  'plantuml',
  'puml',
  'graphviz',
  'dot',
  'viz',
  'd2',
  'vegalite',
  'vega-lite',
  'ditaa',
  'nomnoml',
  'svgbob',
  'bytefield',
  'c4plantuml',
  'erd',
  'blockdiag',
  'seqdiag',
  'actdiag',
  'nwdiag',
  'packetdiag',
  'rackdiag',
  'excalidraw',
  'structurizr',
  'umlet',
];

export const WAVEDROM_LANGUAGES = ['wavedrom'];

export const ALL_DIAGRAM_LANGUAGES = [
  ...KROKI_LANGUAGES,
  ...WAVEDROM_LANGUAGES,
];
