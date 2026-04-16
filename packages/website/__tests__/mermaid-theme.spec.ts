import { describe, expect, it } from 'vitest';
import {
  getMermaidConfig,
  normalizeMermaidThemeMode,
} from '../components/Markdown/mermaidTheme';

describe('mermaid theme config', () => {
  it('maps light mode to Mermaid official default theme', () => {
    expect(getMermaidConfig('light')).toMatchObject({
      startOnLoad: true,
      darkMode: false,
      theme: 'default',
      fontFamily: 'Trebuchet MS, Verdana, Arial, sans-serif',
    });
  });

  it('maps dark mode to Mermaid official dark theme', () => {
    expect(getMermaidConfig('dark')).toMatchObject({
      startOnLoad: true,
      darkMode: true,
      theme: 'dark',
      fontFamily: 'Trebuchet MS, Verdana, Arial, sans-serif',
    });
  });

  it('normalizes unknown theme values back to light mode', () => {
    expect(normalizeMermaidThemeMode('light')).toBe('light');
    expect(normalizeMermaidThemeMode('dark')).toBe('dark');
    expect(normalizeMermaidThemeMode('auto')).toBe('light');
    expect(normalizeMermaidThemeMode(undefined)).toBe('light');
  });
});
