export type DiagramThemeMode = 'light' | 'dark';

export interface DiagramRenderOptions {
  themeMode: DiagramThemeMode;
}

export interface DiagramRenderer {
  languages: string[];
  render(source: string, opts: DiagramRenderOptions): Promise<string>;
}

export const WAVEDROM_LANGUAGES = ['wavedrom'];

export const ALL_DIAGRAM_LANGUAGES = [...WAVEDROM_LANGUAGES];
