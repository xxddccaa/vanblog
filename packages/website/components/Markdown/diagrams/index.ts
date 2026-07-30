import type { BytemdPlugin } from 'bytemd';
import type { DiagramThemeMode } from './types';
import { ALL_DIAGRAM_LANGUAGES } from './types';

export function diagramPlugin(themeMode: DiagramThemeMode): BytemdPlugin {
  return {
    viewerEffect: ({ markdownBody }) => {
      import('./renderDiagramBlocks').then(({ renderDiagramBlocks }) => {
        renderDiagramBlocks(markdownBody, themeMode);
      });
    },
  };
}

export { ALL_DIAGRAM_LANGUAGES, KROKI_LANGUAGES, WAVEDROM_LANGUAGES } from './types';
export type { DiagramThemeMode } from './types';
export { renderDiagramBlocks } from './renderDiagramBlocks';
