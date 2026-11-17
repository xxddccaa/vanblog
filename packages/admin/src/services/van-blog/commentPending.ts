import { getCommentStats } from '@/services/van-blog/api';
import { useEffect, useState } from 'react';

/** The sidebar badge asks the server at most this often. */
export const COMMENT_PENDING_REFRESH_MS = 60_000;

type Listener = (count: number | null) => void;

let pendingCount: number | null = null;
let lastFetchedAt = 0;
let inflight: Promise<number | null> | null = null;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener(pendingCount));
};

export function getCommentPendingCount() {
  return pendingCount;
}

export function setCommentPendingCount(count: unknown) {
  const next =
    typeof count === 'number' && Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
  lastFetchedAt = Date.now();
  if (next === pendingCount) return;
  pendingCount = next;
  notify();
}

/** Lets pages that already loaded /stats update the badge without a new request. */
export function publishCommentStats(stats: unknown) {
  if (stats && typeof stats === 'object' && typeof (stats as any).pending === 'number') {
    setCommentPendingCount((stats as any).pending);
  }
}

export function subscribeCommentPending(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Fetches /stats unless a fetch happened within COMMENT_PENDING_REFRESH_MS.
 * Concurrent callers share one request. Failures keep the last known count.
 */
export function refreshCommentPending(options: { force?: boolean } = {}) {
  if (inflight) return inflight;
  if (!options.force && lastFetchedAt && Date.now() - lastFetchedAt < COMMENT_PENDING_REFRESH_MS) {
    return Promise.resolve(pendingCount);
  }
  lastFetchedAt = Date.now();
  inflight = getCommentStats({ skipErrorHandler: true, skipAuthExpiredHandler: true })
    .then((response: any) => {
      if (Number(response?.statusCode) === 200) publishCommentStats(response?.data);
      return pendingCount;
    })
    .catch(() => pendingCount)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetCommentPendingState() {
  pendingCount = null;
  lastFetchedAt = 0;
  inflight = null;
  listeners.clear();
}

export function useCommentPendingCount() {
  const [count, setCount] = useState<number | null>(pendingCount);
  useEffect(() => {
    setCount(pendingCount);
    return subscribeCommentPending(setCount);
  }, []);
  return count;
}

/**
 * Keeps the pending count fresh while the admin shell is open: once on mount,
 * then every minute while the tab is visible.
 */
export function useCommentPendingPolling(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshCommentPending();
    };
    tick();
    const timer = window.setInterval(tick, COMMENT_PENDING_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled]);
}
