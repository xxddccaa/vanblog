// @vitest-environment jsdom
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const instances: Array<{
  element: HTMLElement;
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}> = [];
vi.mock('headroom.js', () => ({
  default: class {
    init = vi.fn();
    destroy = vi.fn();
    constructor(public element: HTMLElement) {
      instances.push(this);
    }
  },
}));
vi.mock('../components/MarkdownTocBar', () => ({ default: () => null }));
vi.mock('../components/SocialCard', () => ({ default: () => null }));
vi.mock('../components/ImageBox', () => ({ default: () => null }));
vi.mock('../api/getSiteStats', () => ({
  getSiteStats: async () => ({ postNum: 0, categoryNum: 0, tagNum: 0 }),
}));

describe('sidebar Headroom ownership', () => {
  afterEach(() => {
    instances.length = 0;
    document.body.innerHTML = '';
  });

  it.each(['author', 'toc'])(
    'cleans up %s on StrictMode replay, config change and unmount',
    async (kind) => {
      const { default: AuthorCard } = await import('../components/AuthorCard');
      const { default: Toc } = await import('../components/Toc');
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      const render = async (showSubMenu: 'true' | 'false') => {
        await act(async () =>
          root.render(
            <StrictMode>
              {kind === 'toc' ? (
                <Toc content="# Heading" showSubMenu={showSubMenu} />
              ) : (
                <AuthorCard
                  option={{
                    author: 'test',
                    desc: '',
                    logo: '',
                    logoDark: '',
                    socials: [],
                    showRSS: 'false',
                    showSubMenu,
                  }}
                />
              )}
            </StrictMode>,
          ),
        );
      };
      await render('true');
      expect(instances).toHaveLength(2);
      expect(instances[0].destroy).toHaveBeenCalledTimes(1);
      expect(instances[1].destroy).not.toHaveBeenCalled();
      expect(instances[1].element).toBe(
        container.querySelector(kind === 'toc' ? '#toc-card' : '#author-card'),
      );
      await render('false');
      expect(instances).toHaveLength(3);
      expect(instances[1].destroy).toHaveBeenCalledTimes(1);
      await act(async () => root.unmount());
      instances.forEach((instance) => {
        expect(instance.init).toHaveBeenCalledTimes(1);
        expect(instance.destroy).toHaveBeenCalledTimes(1);
      });
    },
  );
});
