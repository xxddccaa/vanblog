import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CommentDetail from './CommentDetail';

const baseRecord = {
  id: 9,
  target: 'post:3',
  targetTitle: 'Hello',
  targetUrl: '/post/hello',
  targetAvailable: true,
  parentId: 4,
  rootId: 4,
  replyToNick: 'bob',
  parentExcerpt: '<b>parent</b>',
  nick: '<i>eve</i>',
  mail: 'eve@example.com',
  link: 'javascript:alert(1)',
  content: '<img src=x onerror="alert(1)">\n**not markdown here**',
  status: 'pending',
  isAdmin: false,
  pinned: false,
  likes: 2,
  ip: '203.0.113.9',
  ua: 'Mozilla/5.0 <script>alert(2)</script>',
  location: 'Somewhere',
  browser: 'Chrome 131',
  os: 'Windows 10',
  createdAt: '2026-11-17T10:00:00.000Z',
  updatedAt: '2026-11-17T10:00:00.000Z',
};

describe('CommentDetail', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders visitor data as plain text only', () => {
    const { container } = render(<CommentDetail record={baseRecord} />);

    expect(container.querySelector('img, script, i, b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.textContent).toContain('**not markdown here**');
    expect(container.textContent).toContain('<b>parent</b>');

    const hrefs = Array.from(container.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/post/hello#comment-9']);
    expect(container.innerHTML).not.toMatch(/href="javascript:/i);
  });

  it('links safe visitor sites with nofollow', () => {
    const { container } = render(
      <CommentDetail record={{ ...baseRecord, link: 'https://eve.example.com' }} />,
    );
    const link = container.querySelector('a[href="https://eve.example.com/"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('does not link unavailable targets', () => {
    const { container } = render(
      <CommentDetail record={{ ...baseRecord, targetAvailable: false }} />,
    );
    expect(container.querySelector('a[href^="/post/"]')).toBeNull();
    expect(container.textContent).toContain('已不可用');
  });
});
