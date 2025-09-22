import { Viewer } from "@bytemd/react"
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { customMermaidPlugin } from './mermaidTheme';
import { customContainer } from './customContainer';;
import "katex/dist/katex.min.css";
import rawHTML from "./rawHTML";
import { customCodeBlock } from "./codeBlock";
import { LinkTarget } from "./linkTarget";
import { Heading } from "./heading";
import { Img } from "./img";

const sanitize = (schema) => {
  schema.protocols.src.push('data')
  schema.tagNames.push("center")
  schema.tagNames.push("iframe");
  schema.tagNames.push("script");
  schema.attributes["*"].push("style");
  schema.attributes["*"].push("src");
  schema.attributes["*"].push("scrolling");
  schema.attributes["*"].push("border");
  schema.attributes["*"].push("frameborder");
  schema.attributes["*"].push("framespacing");
  schema.attributes["*"].push("allowfullscreen");
  schema.strip = [];
  return schema
}

export default function ({ content, codeMaxLines = 15 }: { content: string; codeMaxLines?: number }) {
  const plugins = [
    rawHTML(),
    gfm(),
    highlight(),
    math({
      katexOptions: {
        strict: false,
        throwOnError: false,
      }
    }),
    customMermaidPlugin(),
    customContainer(),
    customCodeBlock(codeMaxLines),
    LinkTarget(),
    Heading(),
    Img(),
  ];

  return <div className="markdown-body">
    <Viewer value={content} plugins={plugins} remarkRehype={{ allowDangerousHtml: true }} sanitize={sanitize} />
  </div>
}
