import { isTrue } from './isTrue';

describe('isTrue', () => {
  it.each<[boolean | string | null | undefined, boolean]>([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    ['', false],
    ['TRUE', false],
    ['1', false],
    ['0', false],
    [undefined, false],
    [null, false],
  ])('returns %s for %p', (input, expected) => {
    expect(isTrue(input as any)).toBe(expected);
  });
});
