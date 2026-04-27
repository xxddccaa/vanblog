'use client';

import React, { useMemo, useRef } from 'react';
import { normalizeMermaidThemeMode } from '../Markdown/mermaidTheme';
import { ThemeContext } from '../../utils/themeContext';

function RenderedMarkdownEnhancer({
  containerRef,
  codeMaxLines,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  codeMaxLines: number;
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

      enhanceCodeBlocks(markdownBody, codeMaxLines);
      bindHeadingAnchors(markdownBody);

      if (markdownBody.querySelector('.img-zoom')) {
        const mediumZoom = (await import('medium-zoom')).default;
        if (!disposed && containerRef.current) {
          markdownBody.querySelectorAll<HTMLImageElement>('.img-zoom').forEach((img) => {
            if (img.getAttribute('data-zoomed')) {
              return;
            }
            img.setAttribute('data-zoomed', 'true');
            const zoom = mediumZoom(img);
            cleanups.push(() => zoom.detach());
          });
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

        await renderMermaidBlocks(markdownBody, mermaidThemeMode);
        if (!disposed && containerRef.current) {
          enhanceMermaidExportControls(markdownBody, mermaidThemeMode);
        }
      }
    };

    void applyEnhancements();

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [codeMaxLines, containerRef, theme]);

  return null;
}

export default function RenderedMarkdown(props: {
  html: string;
  content: string;
  codeMaxLines?: number;
}) {
  const { theme } = React.useContext(ThemeContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const mermaidThemeMode = useMemo(() => normalizeMermaidThemeMode(theme), [theme]);

  return (
    <>
      <div
        ref={containerRef}
        id="write"
        className="markdown-body"
        data-vb-mermaid-theme={mermaidThemeMode}
        dangerouslySetInnerHTML={{ __html: props.html }}
      />
      <RenderedMarkdownEnhancer
        containerRef={containerRef}
        codeMaxLines={props.codeMaxLines || 15}
      />
      <noscript />
    </>
  );
}
