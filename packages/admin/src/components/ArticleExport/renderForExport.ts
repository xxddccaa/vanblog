import { getProcessor } from 'bytemd';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { extendedSyntaxPlugin } from '../Editor/plugins/extendedSyntax';

const sanitize = (schema: any) => {
  schema.protocols.src.push('data');
  schema.tagNames.push('center');
  schema.tagNames.push('iframe');
  schema.tagNames.push('mark');
  schema.tagNames.push('abbr');
  schema.attributes['*'].push('style');
  schema.attributes['*'].push('title');
  schema.strip = [];
  return schema;
};

export function renderMarkdownForExport(content: string): string {
  const processor = getProcessor({
    plugins: [
      gfm(),
      highlight(),
      math({
        katexOptions: { strict: false, throwOnError: false },
      }),
      extendedSyntaxPlugin(),
    ],
    remarkRehype: { allowDangerousHtml: true },
    sanitize,
  });

  return String(processor.processSync(content || ''));
}
