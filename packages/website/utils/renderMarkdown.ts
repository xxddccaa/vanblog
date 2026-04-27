import { getProcessor } from 'bytemd';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { customContainer } from '../components/Markdown/customContainer';
import { customCodeBlock } from '../components/Markdown/codeBlock';
import { Heading } from '../components/Markdown/heading';
import { Img } from '../components/Markdown/img';
import { LinkTarget } from '../components/Markdown/linkTarget';
import { normalizeMathDelimiters } from '../components/Markdown/normalizeMathDelimiters';
import rawHTML from '../components/Markdown/rawHTML';

const sanitize = (schema: any) => {
  schema.protocols.src.push('data');
  schema.tagNames.push('center');
  schema.tagNames.push('iframe');
  schema.tagNames.push('script');
  schema.attributes['*'].push('style');
  schema.attributes['*'].push('src');
  schema.attributes['*'].push('scrolling');
  schema.attributes['*'].push('border');
  schema.attributes['*'].push('frameborder');
  schema.attributes['*'].push('framespacing');
  schema.attributes['*'].push('allowfullscreen');
  schema.strip = [];
  return schema;
};

const getServerMarkdownProcessor = (codeMaxLines = 15) =>
  getProcessor({
    plugins: [
      rawHTML(),
      gfm(),
      highlight(),
      math({
        katexOptions: {
          strict: false,
          throwOnError: false,
        },
      }),
      customContainer(),
      customCodeBlock(codeMaxLines),
      LinkTarget(),
      Heading(),
      Img(),
    ],
    remarkRehype: { allowDangerousHtml: true },
    sanitize,
  });

export function renderMarkdownToHtml(content: string, codeMaxLines = 15) {
  const normalizedContent = normalizeMathDelimiters(content || '');
  return String(getServerMarkdownProcessor(codeMaxLines).processSync(normalizedContent));
}
