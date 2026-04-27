import { resolveDocumentViewerLayout } from './layout';

describe('DocumentViewer layout', () => {
  it('uses its own scroll container by default', () => {
    expect(resolveDocumentViewerLayout()).toEqual({
      className: '',
      style: {
        height: '100%',
        minHeight: '100%',
        width: '100%',
        overflow: 'auto',
      },
    });
  });

  it('can inherit scrolling from the parent preview pane', () => {
    expect(resolveDocumentViewerLayout('inherit')).toEqual({
      className: 'document-viewer--inherit-scroll',
      style: {
        height: 'auto',
        minHeight: '100%',
        width: '100%',
        overflow: 'visible',
      },
    });
  });
});
