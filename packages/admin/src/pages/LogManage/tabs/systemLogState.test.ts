import { mergeSystemLogLines } from './systemLogState';

describe('system log state', () => {
  it('appends incremental lines and caps the retained window', () => {
    expect(
      mergeSystemLogLines(['one', 'two'], {
        data: ['three', 'four'],
        reset: false,
      }, 3),
    ).toEqual(['two', 'three', 'four']);
  });

  it('replaces the current window when the server reports a reset', () => {
    expect(
      mergeSystemLogLines(['old'], {
        data: ['new-1', 'new-2'],
        reset: true,
      }),
    ).toEqual(['new-1', 'new-2']);
  });

  it('treats malformed batches as empty increments', () => {
    expect(mergeSystemLogLines(['keep'], {})).toEqual(['keep']);
  });
});
