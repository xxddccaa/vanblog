import mermaid from '@bytemd/plugin-mermaid';

export type MermaidThemeMode = 'light' | 'dark';

const MERMAID_FONT_FAMILY = 'Trebuchet MS, Verdana, Arial, sans-serif';

export function normalizeMermaidThemeMode(themeMode?: string): MermaidThemeMode {
  return themeMode === 'dark' ? 'dark' : 'light';
}

// Follow Mermaid's official light/dark themes instead of forcing one custom
// base palette across both site themes.
export function getMermaidConfig(themeMode: MermaidThemeMode = 'light') {
  const resolvedThemeMode = normalizeMermaidThemeMode(themeMode);

  return {
    startOnLoad: true,
    darkMode: resolvedThemeMode === 'dark',
    theme: resolvedThemeMode === 'dark' ? 'dark' : 'default',
    fontFamily: MERMAID_FONT_FAMILY,
  };
}

export const customMermaidPlugin = (themeMode: MermaidThemeMode = 'light') =>
  mermaid(getMermaidConfig(themeMode));
