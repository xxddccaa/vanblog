import { isTrue } from './isTrue';
import { checkTrue } from './checkTrue';

describe('isTrue', () => {
  it.each<[boolean | string | null | undefined, boolean]>([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    ['', false],
    ['TRUE', false],
    [undefined, false],
    [null, false],
  ])('returns %s for %p and matches checkTrue', (input, expected) => {
    expect(isTrue(input as any)).toBe(expected);
    expect(checkTrue(input as any)).toBe(expected);
  });

  it('rejects numeric strings strictly', () => {
    expect(isTrue('1')).toBe(false);
    expect(isTrue('0')).toBe(false);
  });
});
