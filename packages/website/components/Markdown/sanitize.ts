import DOMPurify from 'dompurify';

export function configureMarkdownSanitizeSchema(schema: any) {
  return {
    ...schema,
    tagNames: Array.from(new Set([...(schema.tagNames || []), 'center'])),
    protocols: {
      ...schema.protocols,
      src: Array.from(new Set([...(schema.protocols?.src || []), 'data'])),
    },
    attributes: {
      ...schema.attributes,
      '*': Array.from(new Set([...(schema.attributes?.['*'] || []), 'className'])),
    },
  };
}

export function sanitizeDiagramSvg(svg: string) {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'style'],
    FORBID_ATTR: ['style'],
  });
}
