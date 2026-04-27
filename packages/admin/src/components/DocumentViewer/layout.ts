export type DocumentViewerScrollContainer = 'self' | 'inherit';

export function resolveDocumentViewerLayout(
  scrollContainer: DocumentViewerScrollContainer = 'self',
) {
  const inheritScroll = scrollContainer === 'inherit';

  return {
    className: inheritScroll ? 'document-viewer--inherit-scroll' : '',
    style: {
      height: inheritScroll ? 'auto' : '100%',
      minHeight: '100%',
      width: '100%',
      overflow: inheritScroll ? 'visible' : 'auto',
    } as const,
  };
}
