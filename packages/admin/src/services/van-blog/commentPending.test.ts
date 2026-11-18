import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCommentStats = vi.fn();

vi.mock('@/services/van-blog/api', () => ({
  getCommentStats: (...args: unknown[]) => getCommentStats(...args),
}));

describe('comment pending badge store', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
    getCommentStats.mockReset();
    const store = await import('./commentPending');
    store.resetCommentPendingState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches at most once per minute unless forced', async () => {
    const store = await import('./commentPending');
    getCommentStats.mockResolvedValue({ statusCode: 200, data: { pending: 4 } });

    await expect(store.refreshCommentPending()).resolves.toBe(4);
    await store.refreshCommentPending();
    expect(getCommentStats).toHaveBeenCalledTimes(1);
    expect(getCommentStats).toHaveBeenCalledWith({
      skipErrorHandler: true,
      skipAuthExpiredHandler: true,
    });

    vi.advanceTimersByTime(store.COMMENT_PENDING_REFRESH_MS - 1);
    await store.refreshCommentPending();
    expect(getCommentStats).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    getCommentStats.mockResolvedValue({ statusCode: 200, data: { pending: 2 } });
    await expect(store.refreshCommentPending()).resolves.toBe(2);
    expect(getCommentStats).toHaveBeenCalledTimes(2);

    await store.refreshCommentPending({ force: true });
    expect(getCommentStats).toHaveBeenCalledTimes(3);
  });

  it('shares one request between concurrent callers', async () => {
    const store = await import('./commentPending');
    let resolve: (value: unknown) => void = () => undefined;
    getCommentStats.mockReturnValue(new Promise((done) => (resolve = done)));

    const first = store.refreshCommentPending({ force: true });
    const second = store.refreshCommentPending({ force: true });
    resolve({ statusCode: 200, data: { pending: 1 } });

    await expect(Promise.all([first, second])).resolves.toEqual([1, 1]);
    expect(getCommentStats).toHaveBeenCalledTimes(1);
  });

  it('keeps the last count on failures and notifies subscribers on changes', async () => {
    const store = await import('./commentPending');
    const listener = vi.fn();
    store.subscribeCommentPending(listener);

    store.publishCommentStats({ pending: 3, recent: [] });
    expect(store.getCommentPendingCount()).toBe(3);
    expect(listener).toHaveBeenLastCalledWith(3);

    getCommentStats.mockResolvedValue({ statusCode: 403, message: 'Forbidden resource' });
    await store.refreshCommentPending({ force: true });
    getCommentStats.mockRejectedValue(new Error('offline'));
    await store.refreshCommentPending({ force: true });
    expect(store.getCommentPendingCount()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);

    store.publishCommentStats({ pending: 0 });
    expect(listener).toHaveBeenLastCalledWith(0);
    store.publishCommentStats({ nothing: true });
    expect(store.getCommentPendingCount()).toBe(0);
  });

  it('counts a published stats payload as a fresh fetch', async () => {
    const store = await import('./commentPending');
    getCommentStats.mockResolvedValue({ statusCode: 200, data: { pending: 9 } });
    store.publishCommentStats({ pending: 5 });
    await expect(store.refreshCommentPending()).resolves.toBe(5);
    expect(getCommentStats).not.toHaveBeenCalled();
  });
});
