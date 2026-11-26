import { parseHtmlToHeadTagArr } from './htmlParser';

describe('parseHtmlToHeadTagArr', () => {
  it('parses head tags with their attributes', () => {
    const html =
      '<meta name="verify" content="abc"><link rel="preconnect" href="https://example.com">';

    expect(parseHtmlToHeadTagArr(html)).toEqual([
      {
        name: 'meta',
        props: { name: 'verify', content: 'abc' },
        content: undefined,
      },
      {
        name: 'link',
        props: { rel: 'preconnect', href: 'https://example.com' },
        content: undefined,
      },
    ]);
  });

  it('returns an empty array for empty html', () => {
    expect(parseHtmlToHeadTagArr('')).toEqual([]);
  });
});
