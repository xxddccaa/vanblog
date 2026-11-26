import { parseImgLinksOfMarkdown } from './parseImgOfMarkdown';

describe('parseImgLinksOfMarkdown', () => {
  it('extracts unique http image links from markdown content', () => {
    const markdown = [
      '![cover](https://example.com/a.png)',
      '![dup](https://example.com/a.png)',
      '![local](/static/img/local.png)',
      '![photo](http://example.com/b.jpg)',
    ].join('\n');

    expect(parseImgLinksOfMarkdown(markdown)).toEqual([
      'https://example.com/a.png',
      'http://example.com/b.jpg',
    ]);
  });

  it('returns an empty list when no external image links are present', () => {
    expect(parseImgLinksOfMarkdown('plain text without images')).toEqual([]);
  });
});
