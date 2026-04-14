import { wordCount } from './wordCount';

describe('wordCount', () => {
  it('returns 0 for empty or missing content', () => {
    expect(wordCount()).toBe(0);
    expect(wordCount(null)).toBe(0);
    expect(wordCount('')).toBe(0);
  });

  it('counts mixed Chinese and ASCII characters', () => {
    expect(wordCount('你好vanblog')).toBe(9);
  });
});
