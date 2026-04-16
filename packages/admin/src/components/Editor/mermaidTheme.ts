import mermaid from '@bytemd/plugin-mermaid';

export type MermaidThemeMode = 'light' | 'dark';

const MERMAID_FONT_FAMILY = 'Trebuchet MS, Verdana, Arial, sans-serif';

export function normalizeMermaidThemeMode(themeMode?: string): MermaidThemeMode {
  return themeMode === 'dark' ? 'dark' : 'light';
}

// Keep the admin preview aligned with Mermaid's official light/dark themes so
// the SVG palette follows the current shell theme naturally.
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
