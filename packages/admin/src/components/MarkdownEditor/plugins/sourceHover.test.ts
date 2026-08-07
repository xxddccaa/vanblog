import {
  annotateSourceBlockTree,
  findBestSourceBlock,
  isBlockOutsideViewport,
  parseSourceBlockRange,
} from './sourceHover';

describe('sourceHoverPlugin helpers', () => {
  it('annotates supported preview blocks with source line metadata', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          properties: {},
          position: {
            start: { line: 3 },
            end: { line: 4 },
          },
          children: [],
        },
        {
          type: 'element',
          tagName: 'span',
          properties: {},
          position: {
            start: { line: 3 },
            end: { line: 3 },
          },
          children: [],
        },
      ],
    };

    annotateSourceBlockTree(tree);

    expect(tree.children[0].properties).toEqual({
      dataVbSourceStart: '3',
      dataVbSourceEnd: '4',
    });
    expect(tree.children[1].properties).toEqual({});
  });

  it('parses valid line ranges and rejects malformed metadata', () => {
    expect(parseSourceBlockRange('2', '5')).toEqual({
      startLine: 2,
      endLine: 5,
    });
    expect(parseSourceBlockRange('5', '2')).toBeNull();
    expect(parseSourceBlockRange('0', '2')).toBeNull();
    expect(parseSourceBlockRange('line', '2')).toBeNull();
  });

  it('selects the smallest readable block and then the most specific block', () => {
    const blocks = [
      { id: 'quote', startLine: 1, endLine: 8, depth: 1, priority: 55 },
      { id: 'paragraph', startLine: 3, endLine: 4, depth: 2, priority: 40 },
      { id: 'code', startLine: 3, endLine: 4, depth: 3, priority: 80 },
    ];

    expect(findBestSourceBlock(blocks, 3)?.id).toBe('code');
    expect(findBestSourceBlock(blocks, 7)?.id).toBe('quote');
    expect(findBestSourceBlock(blocks, 10)).toBeNull();
  });

  it('only requests preview scrolling when the block is fully outside', () => {
    const viewport = { top: 100, bottom: 500 };

    expect(isBlockOutsideViewport({ top: 200, bottom: 300 }, viewport)).toBe(false);
    expect(isBlockOutsideViewport({ top: 450, bottom: 550 }, viewport)).toBe(false);
    expect(isBlockOutsideViewport({ top: 20, bottom: 90 }, viewport)).toBe(true);
    expect(isBlockOutsideViewport({ top: 510, bottom: 600 }, viewport)).toBe(true);
  });
});
