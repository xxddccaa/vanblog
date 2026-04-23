import { consumeMarkdownUpdate, shouldSyncExternalMarkdown } from './sync';

describe('MarkdownEditor sync helpers', () => {
  it('decides when external value should replace editor markdown', () => {
    expect(shouldSyncExternalMarkdown('next', 'prev')).toBe(true);
    expect(shouldSyncExternalMarkdown('same', 'same')).toBe(false);
  });

  it('suppresses the next change notification after programmatic editor sync', () => {
    const result = consumeMarkdownUpdate(
      {
        currentMarkdown: 'server value',
        suppressNextChange: true,
      },
      'server value',
    );

    expect(result.shouldEmit).toBe(false);
    expect(result.state).toEqual({
      currentMarkdown: 'server value',
      suppressNextChange: false,
    });
  });

  it('emits change notifications for user edits without looping', () => {
    const result = consumeMarkdownUpdate(
      {
        currentMarkdown: 'before',
        suppressNextChange: false,
      },
      'after',
    );

    expect(result.shouldEmit).toBe(true);
    expect(result.state).toEqual({
      currentMarkdown: 'after',
      suppressNextChange: false,
    });
  });
});
