'use client';

import '../../styles/markdown-content.css';
import React, { useMemo, useRef } from 'react';
import { normalizeMermaidThemeMode } from '../Markdown/mermaidTheme';
import { ThemeContext } from '../../utils/themeContext';

function RenderedMarkdownEnhancer({
  containerRef,
  codeMaxLines,
  html,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  codeMaxLines: number;
  html: string;
}) {
  const { theme } = React.useContext(ThemeContext);

  React.useEffect(() => {
    const markdownBody = containerRef.current;
    if (!markdownBody) {
      return;
    }

    let disposed = false;
    const cleanups: Array<() => void> = [];

    const applyEnhancements = async () => {
      const [{ enhanceCodeBlocks }, { bindHeadingAnchors }] = await Promise.all([
        import('../Markdown/codeBlock'),
        import('../Markdown/heading'),
      ]);

      if (disposed || !containerRef.current) {
        return;
      }

      cleanups.push(enhanceCodeBlocks(markdownBody, codeMaxLines));
      bindHeadingAnchors(markdownBody);

      if (markdownBody.querySelector('.img-zoom')) {
        const { enhanceImages } = await import('../Markdown/img');
        if (!disposed && containerRef.current) {
          cleanups.push(enhanceImages(markdownBody));
        }
      }

      if (
        markdownBody.querySelector('pre > code.language-mermaid') ||
        markdownBody.querySelector('.bytemd-mermaid, .mermaid')
      ) {
        const mermaidThemeMode = normalizeMermaidThemeMode(theme);
        const [{ renderMermaidBlocks }, { enhanceMermaidExportControls }] = await Promise.all([
          import('../Markdown/mermaidTheme'),
          import('../Markdown/mermaidExport'),
        ]);

        if (disposed || !containerRef.current) {
          return;
        }

        await renderMermaidBlocks(markdownBody, mermaidThemeMode, () => !disposed);
        if (!disposed && containerRef.current) {
          enhanceMermaidExportControls(markdownBody, mermaidThemeMode);
        }
      }

      // Render non-mermaid diagrams (PlantUML, GraphViz, WaveDrom, etc.)
      const { renderDiagramBlocks } = await import('../Markdown/diagrams/renderDiagramBlocks');
      if (!disposed && containerRef.current) {
        const diagramThemeMode = normalizeMermaidThemeMode(theme);
        await renderDiagramBlocks(markdownBody, diagramThemeMode, () => !disposed);
      }
    };

    void applyEnhancements().catch((error) => {
      if (!disposed) console.error('Markdown enhancement failed', error);
    });

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [codeMaxLines, containerRef, theme, html]);

  return null;
}

export default function RenderedMarkdown(props: {
  html: string;
  content: string;
  codeMaxLines?: number;
  embedded?: boolean;
}) {
  const { theme } = React.useContext(ThemeContext);
  const containerRef = useRef<HTMLDivElement>(null);
  // Preserve enhanced DOM and user control state when only the theme changes.
  const innerHtml = useMemo(() => ({ __html: props.html }), [props.html]);
  const mermaidThemeMode = useMemo(() => normalizeMermaidThemeMode(theme), [theme]);

  return (
    <>
      <div
        ref={containerRef}
        id="write"
        className={`markdown-body${props.embedded ? ' vb-embedded-markdown' : ''}`}
        data-vb-mermaid-theme={mermaidThemeMode}
        dangerouslySetInnerHTML={innerHtml}
      />
      <RenderedMarkdownEnhancer
        containerRef={containerRef}
        codeMaxLines={props.codeMaxLines || 15}
        html={props.html}
      />
      <noscript />
    </>
  );
}
