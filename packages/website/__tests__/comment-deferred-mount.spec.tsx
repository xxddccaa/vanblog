// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../components/Comments/core', () => ({
  default: ({ target }: { target: string }) => <section data-core={target}>core</section>,
}));

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let container: HTMLDivElement;
let root: Root;
let observers: Array<{
  callback: ObserverCallback;
  options: any;
  observe: ReturnType<typeof vi.fn>;
}>;

const flush = async () => {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const mount = async (target = 'post:7') => {
  const { default: Comments } = await import('../components/Comments');
  await act(async () => {
    root.render(<Comments enable="true" target={target} />);
  });
  await flush();
};

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: ObserverCallback, options: any) {
        observers.push({ callback, options, observe: this.observe });
      }
    },
  );
  window.history.replaceState(null, '', '/post/7');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('deferred comment section', () => {
  it('waits until the placeholder approaches the viewport', async () => {
    await mount();

    expect(container.querySelector('[data-core]')).toBeNull();
    expect(container.textContent).toContain('评论加载中');
    expect(observers).toHaveLength(1);
    expect(observers[0].options.rootMargin).toBe('600px 0px');
    expect(observers[0].observe).toHaveBeenCalledWith(container.querySelector('#comments'));

    await act(async () => {
      observers[0].callback([{ isIntersecting: true }]);
    });
    await flush();
    expect(container.querySelector('[data-core="post:7"]')).toBeTruthy();
  });

  it('loads immediately for comment deep links', async () => {
    window.history.replaceState(null, '', '/post/7#comment-12');
    await mount();
    expect(container.querySelector('[data-core="post:7"]')).toBeTruthy();
  });

  it('loads when a comment anchor is opened later', async () => {
    await mount();
    expect(container.querySelector('[data-core]')).toBeNull();
    await act(async () => {
      window.history.replaceState(null, '', '/post/7#comments');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await flush();
    expect(container.querySelector('[data-core="post:7"]')).toBeTruthy();
  });
});
