"use client";

import React, { useContext, useMemo } from "react";
import { Viewer } from "@bytemd/react";
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { customMermaidExportPlugin } from './mermaidExport';
import { customMermaidPlugin, normalizeMermaidThemeMode } from './mermaidTheme';
import { diagramPlugin } from './diagrams';
import { extendedSyntaxPlugin } from './extendedSyntax';
import { customContainer } from './customContainer';
import "katex/dist/katex.min.css";
import rawHTML from "./rawHTML";
import { customCodeBlock } from "./codeBlock";
import { LinkTarget } from "./linkTarget";
import { Heading } from "./heading";
import { Img } from "./img";
import { ThemeContext } from "../../utils/themeContext";
import { bracketMathPlugin } from "./bracketMath";
import { configureMarkdownSanitizeSchema } from "./sanitize";

export default function ({
  content,
  codeMaxLines = 15,
  embedded = false,
}: {
  content: string;
  codeMaxLines?: number;
  embedded?: boolean;
}) {
  const { theme } = useContext(ThemeContext);
  const mermaidThemeMode = normalizeMermaidThemeMode(theme);

  const plugins = useMemo(
    () => [
      rawHTML(),
      gfm(),
      highlight(),
      math({
        katexOptions: {
          strict: false,
          throwOnError: false,
        },
      }),
      bracketMathPlugin(),
      customMermaidPlugin(mermaidThemeMode),
      customMermaidExportPlugin(mermaidThemeMode),
      diagramPlugin(mermaidThemeMode),
      extendedSyntaxPlugin(),
      customContainer(),
      customCodeBlock(codeMaxLines),
      LinkTarget(),
      Heading(),
      Img(),
    ],
    [codeMaxLines, mermaidThemeMode],
  );

  // 为了更好兼容常见编辑器（如外部 Markdown 主题通常以 #write 作为根容器），
  // 这里同时提供 id="write" 和 className="markdown-body"。
  return (
    <div
      id="write"
      className={`markdown-body${embedded ? ' vb-embedded-markdown' : ''}`}
      data-vb-mermaid-theme={mermaidThemeMode}
    >
      <Viewer
        key={`markdown-viewer-${mermaidThemeMode}`}
        value={content}
        plugins={plugins}
        remarkRehype={{ allowDangerousHtml: true }}
        sanitize={configureMarkdownSanitizeSchema}
      />
    </div>
  );
}
