export type MarkdownSyncState = {
  currentMarkdown: string;
  suppressNextChange: boolean;
};

export function shouldSyncExternalMarkdown(nextValue: string, currentMarkdown: string) {
  return nextValue !== currentMarkdown;
}

export function consumeMarkdownUpdate(state: MarkdownSyncState, nextMarkdown: string) {
  if (state.suppressNextChange) {
    return {
      state: {
        currentMarkdown: nextMarkdown,
        suppressNextChange: false,
      },
      shouldEmit: false,
    };
  }

  if (nextMarkdown === state.currentMarkdown) {
    return {
      state,
      shouldEmit: false,
    };
  }

  return {
    state: {
      currentMarkdown: nextMarkdown,
      suppressNextChange: false,
    },
    shouldEmit: true,
  };
}
