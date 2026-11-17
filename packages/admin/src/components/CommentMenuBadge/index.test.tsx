import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@umijs/max', () => ({
  Link: ({ to, children }: any) => (
    <a data-testid="menu-link" href={to}>
      {children}
    </a>
  ),
}));

vi.mock('@/services/van-blog/api', () => ({
  getCommentStats: vi.fn(),
}));

const defaultDom = (
  <div className="menu-title">
    <span className="menu-icon" />
    <span className="menu-text">label</span>
  </div>
);

describe('comment menu badge', () => {
  beforeEach(async () => {
    const store = await import('@/services/van-blog/commentPending');
    store.resetCommentPendingState();
  });

  afterEach(() => {
    cleanup();
  });

  it('adds the pending badge only to the comment menu entry', async () => {
    const { renderAdminMenuItem } = await import('./index');
    const store = await import('@/services/van-blog/commentPending');
    store.publishCommentStats({ pending: 7 });

    render(
      <>
        {renderAdminMenuItem({ path: '/site/comment' }, defaultDom)}
        {renderAdminMenuItem({ path: '/article' }, defaultDom)}
      </>,
    );

    const links = screen.getAllByTestId('menu-link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/site/comment', '/article']);
    expect(links[0].querySelector('.menu-title .menu-text')).not.toBeNull();
    expect(links[0].textContent).toContain('7');
    expect(links[1].textContent).toBe('label');
  });

  it('keeps the umi default link behaviour', async () => {
    const { renderAdminMenuItem } = await import('./index');
    const current = render(
      <>{renderAdminMenuItem({ path: '/article', replace: true }, defaultDom)}</>,
    );
    expect(current.queryByTestId('menu-link')).toBeNull();
    cleanup();

    const external = render(
      <>{renderAdminMenuItem({ path: 'https://example.com', isUrl: true }, defaultDom)}</>,
    );
    expect(external.queryByTestId('menu-link')).toBeNull();
  });

  it('hides the badge at zero and updates when the count changes', async () => {
    const { renderAdminMenuItem } = await import('./index');
    const store = await import('@/services/van-blog/commentPending');
    store.publishCommentStats({ pending: 0 });

    render(<>{renderAdminMenuItem({ path: '/site/comment' }, defaultDom)}</>);
    expect(screen.queryByTestId('comment-menu-pending-badge')).toBeNull();

    act(() => {
      store.publishCommentStats({ pending: 2 });
    });
    expect(screen.getByTestId('comment-menu-pending-badge').textContent).toContain('2');
  });
});
