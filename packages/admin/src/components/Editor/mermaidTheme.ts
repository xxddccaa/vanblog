import mermaid from '@bytemd/plugin-mermaid';

// Keep the editor Mermaid palette aligned with the frontend so diagrams stay
// readable in both light and dark admin themes.
export function getMermaidConfig() {
  return {
    startOnLoad: true,
    theme: 'base',
    themeVariables: {
      primaryColor: '#e1f5fe',
      primaryTextColor: '#0d47a1',
      primaryBorderColor: '#1976d2',
      lineColor: '#0d47a1',

      tertiaryColor: '#f3e5f5',
      tertiaryTextColor: '#4a148c',
      tertiaryBorderColor: '#7b1fa2',

      background: '#ffffff',
      secondaryColor: '#fff3e0',
      secondaryTextColor: '#e65100',
      secondaryBorderColor: '#ff9800',

      mainBkg: '#e1f5fe',
      textColor: '#0d47a1',
      labelTextColor: '#0d47a1',
      nodeTextColor: '#0d47a1',

      actorBkg: '#e8f5e8',
      actorBorder: '#4caf50',
      actorTextColor: '#2e7d32',

      titleColor: '#0d47a1',
      edgeLabelBackground: '#ffffff',

      fillType0: '#e1f5fe',
      fillType1: '#f3e5f5',
      fillType2: '#fff3e0',
      fillType3: '#e8f5e8',
    },
  };
}

export const customMermaidPlugin = () => mermaid(getMermaidConfig());
