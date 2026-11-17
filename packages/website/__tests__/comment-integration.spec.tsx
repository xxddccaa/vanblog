import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}));
vi.mock('../components/AlertCard', () => ({ default: () => null }));
vi.mock('../components/CopyRight', () => ({ default: () => null }));
vi.mock('../components/Reward', () => ({ default: () => null }));
vi.mock('../components/TopPinIcon', () => ({ default: () => null }));
vi.mock('../components/UnLockCard', () => ({ default: () => null }));
vi.mock('../components/TocMobile', () => ({ default: () => null }));
vi.mock('../components/RenderedMarkdown', () => ({ default: () => null }));
vi.mock('../components/Markdown', () => ({ default: () => null }));
vi.mock('../components/PostViewerStats', () => ({ default: () => null }));
vi.mock('../components/PostCard/bottom', () => ({ PostBottom: () => null }));
vi.mock('../components/PostCard/fragments', () => ({ default: () => null }));
vi.mock('../components/Comments', () => ({
  default: ({ enable, target }: { enable: string; target: string | null }) =>
    React.createElement('div', { 'data-comments': String(target), 'data-enable': enable }),
}));

const baseProps = {
  title: 'Edge Cache Post',
  updatedAt: new Date('2026-04-11T00:00:00.000Z'),
  createdAt: new Date('2026-04-09T00:00:00.000Z'),
  catelog: 'Architecture',
  initialContent: 'post body',
  initialRenderedHtml: '<p>post body</p>',
  enableComment: 'true' as const,
  top: 0,
  private: false,
  openArticleLinksInNewWindow: false,
  copyrightAggreement: 'CC BY-NC-SA 4.0',
  customCopyRight: null,
  showExpirationReminder: false,
  showEditButton: false,
};

const render = async (props: Record<string, unknown>) => {
  const { default: RichPostCard } = await import('../components/RichPostCard');
  return renderToStaticMarkup(React.createElement(RichPostCard as any, { ...baseProps, ...props }));
};

describe('comment section integration', () => {
  it('addresses article threads by numeric article id', async () => {
    const html = await render({ id: 42, type: 'article' });
    expect(html).toContain('data-comments="post:42"');
    expect(html).toContain('data-enable="true"');
  });

  it('keys the thread by the numeric id when the article has a custom pathname', async () => {
    const html = await render({ id: 'hello-world', articleId: 7, type: 'article' });
    expect(html).toContain('data-comments="post:7"');
    expect(html).toContain('data-enable="true"');
  });

  it('shows a visible about-page thread', async () => {
    const html = await render({ id: 0, type: 'about' });
    expect(html).toContain('data-comments="page:about"');
    expect(html).toContain('data-enable="true"');
  });

  it('honours the global comment switch', async () => {
    const html = await render({ id: 42, type: 'article', enableComment: 'false' });
    expect(html).toContain('data-enable="false"');
  });

  it('keeps comments closed on password-protected articles', async () => {
    const html = await render({ id: 42, type: 'article', private: true });
    expect(html).toContain('data-enable="false"');
  });
});

describe('lazy comment wrapper', () => {
  it('renders nothing when disabled or when the target is invalid', async () => {
    vi.doUnmock('../components/Comments');
    vi.resetModules();
    const { default: Comments } = await import('../components/Comments');
    expect(renderToStaticMarkup(<Comments enable="false" target="post:1" />)).toBe('');
    expect(renderToStaticMarkup(<Comments enable="true" target="post:abc" />)).toBe('');
    expect(renderToStaticMarkup(<Comments enable="true" target="page:moment" />)).toBe('');
    expect(renderToStaticMarkup(<Comments enable="true" target={null} />)).toBe('');
  });

  it('never renders the client-only section into server HTML', async () => {
    vi.doUnmock('../components/Comments');
    vi.resetModules();
    const { default: Comments } = await import('../components/Comments');
    const html = renderToStaticMarkup(<Comments enable="true" target="post:1" />);
    expect(html).not.toContain('发表评论');
  });
});
