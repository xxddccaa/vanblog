import { getProcessor } from 'bytemd';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { customContainer } from '../components/Markdown/customContainer';
import { customCodeBlock } from '../components/Markdown/codeBlock';
import { Heading } from '../components/Markdown/heading';
import { Img } from '../components/Markdown/img';
import { LinkTarget } from '../components/Markdown/linkTarget';
import { bracketMathPlugin } from '../components/Markdown/bracketMath';
import { extendedSyntaxPlugin } from '../components/Markdown/extendedSyntax';
import rawHTML from '../components/Markdown/rawHTML';
import { configureMarkdownSanitizeSchema } from '../components/Markdown/sanitize';

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
      bracketMathPlugin(),
      extendedSyntaxPlugin(),
      customContainer(),
      customCodeBlock(codeMaxLines),
      LinkTarget(),
      Heading(),
      Img(),
    ],
    remarkRehype: { allowDangerousHtml: true },
    sanitize: configureMarkdownSanitizeSchema,
  });

export function renderMarkdownToHtml(content: string, codeMaxLines = 15) {
  return String(getServerMarkdownProcessor(codeMaxLines).processSync(content || ''));
}
