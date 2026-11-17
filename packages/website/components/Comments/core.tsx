import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COMMENT_SORTS,
  DEFAULT_COMMENT_CONFIG,
  describeCommentError,
  fetchCommentIdentity,
  fetchComments,
  fetchLikedCommentIds,
  isAbortError,
  isCommentUnavailableError,
  toggleCommentLike,
  type CommentSort,
  type CommentTargetKey,
  type CreateCommentResult,
  type PublicComment,
  type PublicCommentIdentity,
  type PublicCommentPage,
} from '../../api/comments';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import {
  clearCommentProfile,
  collectCommentIds,
  EMPTY_PROFILE,
  loadCommentProfile,
  mergeLocalComments,
  parseCommentHash,
  patchCommentTree,
  type CommentProfile,
  type LocalComment,
} from './utils';
import '../../styles/comments.css';

const SORT_LABELS: Record<CommentSort, string> = {
  latest: '最新',
  oldest: '最早',
  hot: '最热',
};

const HIGHLIGHT_MS = 3000;

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

const patchLocal = (entries: LocalComment[], id: number, patch: Partial<PublicComment>) =>
  entries.some((entry) => entry.comment.id === id)
    ? entries.map((entry) =>
        entry.comment.id === id ? { ...entry, comment: { ...entry.comment, ...patch } } : entry,
      )
    : entries;

export default function CommentSection({ target }: { target: CommentTargetKey }) {
  const [sort, setSort] = useState<CommentSort>('latest');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<PublicCommentPage | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [identity, setIdentity] = useState<PublicCommentIdentity>({ admin: false });
  const [profile, setProfile] = useState<CommentProfile>(EMPTY_PROFILE);
  const [remember, setRemember] = useState(true);
  const [liked, setLiked] = useState<Set<number>>(() => new Set());
  const [likeBusy, setLikeBusy] = useState<Set<number>>(() => new Set());
  const [localRoots, setLocalRoots] = useState<LocalComment[]>([]);
  const [localReplies, setLocalReplies] = useState<LocalComment[]>([]);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fetching, setFetching] = useState(true);

  const sectionRef = useRef<HTMLElement>(null);
  const headingId = `vb-comments-heading-${target.replace(/[^a-z0-9]/gi, '-')}`;
  const pendingScrollId = useRef<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledInitialHash = useRef(false);

  const config = useMemo(() => {
    const merged = { ...DEFAULT_COMMENT_CONFIG, ...(data?.config || {}) };
    const maxLength = Number(merged.maxLength);
    return {
      ...merged,
      maxLength:
        Number.isFinite(maxLength) && maxLength > 0 ? maxLength : DEFAULT_COMMENT_CONFIG.maxLength,
    };
  }, [data]);

  // Visitor profile and identity are per browser, never part of the cached list.
  useEffect(() => {
    const stored = loadCommentProfile();
    if (stored) {
      setProfile(stored);
    }
    const controller = new AbortController();
    fetchCommentIdentity(controller.signal)
      .then((result) => setIdentity({ admin: Boolean(result?.admin), nick: result?.nick }))
      .catch(() => setIdentity({ admin: false }));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState((state) => (state === 'ready' ? state : 'loading'));
    setFetching(true);
    fetchComments(target, { page, sort, signal: controller.signal })
      .then((result) => {
        const items = Array.isArray(result?.items) ? result.items : [];
        setData({ ...result, items });
        setLoadState('ready');
        setLoadError('');
        setFetching(false);
        setNow(Date.now());
        // Drop local copies once the server returns them.
        const known = new Set(collectCommentIds(items));
        setLocalRoots((entries) => entries.filter((entry) => !known.has(entry.comment.id)));
        setLocalReplies((entries) => entries.filter((entry) => !known.has(entry.comment.id)));
        const ids = collectCommentIds(items);
        if (ids.length) {
          fetchLikedCommentIds(ids, controller.signal)
            .then((likedIds) => {
              setLiked((current) => {
                const next = new Set(current);
                ids.forEach((id) => next.delete(id));
                likedIds.forEach((id) => next.add(id));
                return next;
              });
            })
            .catch(() => undefined);
        }
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }
        setFetching(false);
        if (isCommentUnavailableError(error)) {
          setLoadState('unavailable');
          return;
        }
        setLoadError(describeCommentError(error));
        setLoadState('error');
      });
    return () => controller.abort();
  }, [target, page, sort, reloadKey]);

  const highlight = useCallback((id: number) => {
    const element = document.getElementById(`comment-${id}`);
    if (!element) {
      return false;
    }
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightId(id);
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return true;
  }, []);

  useEffect(
    () => () => {
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
    },
    [],
  );

  // Deep links: honour #comment-<id> once the first page is rendered, and on later hash changes.
  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }
    if (!handledInitialHash.current) {
      handledInitialHash.current = true;
      const id = parseCommentHash(window.location.hash);
      if (id !== null) {
        highlight(id);
      }
    }
    if (pendingScrollId.current !== null) {
      const id = pendingScrollId.current;
      pendingScrollId.current = null;
      highlight(id);
    }
  }, [loadState, data, localRoots, localReplies, highlight]);

  useEffect(() => {
    const onHashChange = () => {
      const id = parseCommentHash(window.location.hash);
      if (id !== null) {
        highlight(id);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [highlight]);

  // New root comments are shown on the first page only; replies follow their root.
  const items = useMemo(
    () => mergeLocalComments(data?.items || [], page === 1 ? localRoots : [], localReplies),
    [data, page, localRoots, localReplies],
  );

  const pendingIds = useMemo(() => {
    const ids = new Set<number>();
    [...localRoots, ...localReplies].forEach((entry) => {
      if (entry.pending) {
        ids.add(entry.comment.id);
      }
    });
    return ids;
  }, [localRoots, localReplies]);

  const visibleCount =
    (data?.count ?? data?.total ?? 0) +
    [...localRoots, ...localReplies].filter((entry) => !entry.pending).length;
  const totalPages = data
    ? Math.max(1, Math.ceil((data.total || 0) / Math.max(1, data.pageSize || 1)))
    : 1;

  const onRememberChange = (value: boolean) => {
    setRemember(value);
    if (!value) {
      clearCommentProfile();
    }
  };

  const onPosted = (result: CreateCommentResult) => {
    const comment = result?.comment;
    setReplyTo(null);
    setNotice(result?.status === 'pending' ? '评论已提交，审核后显示' : '评论发表成功');
    if (!comment || typeof comment.id !== 'number') {
      return;
    }
    const entry: LocalComment = {
      comment: { ...comment, replies: comment.replies || [] },
      pending: result.status === 'pending',
    };
    if (comment.rootId === null || comment.rootId === undefined) {
      setLocalRoots((entries) => [
        entry,
        ...entries.filter((item) => item.comment.id !== comment.id),
      ]);
    } else {
      setLocalReplies((entries) => [
        ...entries.filter((item) => item.comment.id !== comment.id),
        entry,
      ]);
    }
    setNow(Date.now());
    pendingScrollId.current = comment.id;
  };

  const patchLikes = (id: number, likes: number) => {
    setData((current) =>
      current ? { ...current, items: patchCommentTree(current.items, id, { likes }) } : current,
    );
    setLocalRoots((entries) => patchLocal(entries, id, { likes }));
    setLocalReplies((entries) => patchLocal(entries, id, { likes }));
  };

  const setLikedState = (id: number, value: boolean) => {
    setLiked((current) => {
      const next = new Set(current);
      if (value) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const onLike = async (comment: PublicComment) => {
    const id = comment.id;
    if (likeBusy.has(id)) {
      return;
    }
    const wasLiked = liked.has(id);
    const previousLikes = comment.likes;
    setActionError('');
    setLikeBusy((current) => new Set(current).add(id));
    setLikedState(id, !wasLiked);
    patchLikes(id, Math.max(0, previousLikes + (wasLiked ? -1 : 1)));
    try {
      const result = await toggleCommentLike(id);
      setLikedState(id, Boolean(result?.liked));
      if (typeof result?.likes === 'number') {
        patchLikes(id, Math.max(0, result.likes));
      }
    } catch (error) {
      setLikedState(id, wasLiked);
      patchLikes(id, previousLikes);
      setActionError(describeCommentError(error));
    } finally {
      setLikeBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const onReply = (comment: PublicComment) => {
    setNotice('');
    setReplyTo((current) => (current === comment.id ? null : comment.id));
  };

  const changeSort = (value: CommentSort) => {
    if (value === sort) {
      return;
    }
    setSort(value);
    setPage(1);
    setReplyTo(null);
  };

  const changePage = (value: number) => {
    const next = Math.min(Math.max(1, value), totalPages);
    if (next === page) {
      return;
    }
    setPage(next);
    setReplyTo(null);
    sectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  if (loadState === 'unavailable') {
    return null;
  }

  const formProps = {
    target,
    config,
    identity,
    profile,
    onProfileChange: setProfile,
    remember,
    onRememberChange,
    onPosted,
  };

  const renderReplyForm = (comment: PublicComment) =>
    replyTo === comment.id ? (
      <CommentForm {...formProps} parent={comment} onCancel={() => setReplyTo(null)} autoFocus />
    ) : null;

  const renderItem = (comment: PublicComment, nested: boolean, children?: React.ReactNode) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      nested={nested}
      liked={liked.has(comment.id)}
      likeBusy={likeBusy.has(comment.id)}
      pending={pendingIds.has(comment.id)}
      highlighted={highlightId === comment.id}
      now={now}
      onLike={onLike}
      onReply={onReply}
      replyForm={renderReplyForm(comment)}
    >
      {children}
    </CommentItem>
  );

  return (
    <section
      ref={sectionRef}
      id="comments"
      aria-labelledby={headingId}
      className="vb-comments mt-4 vb-surface-card card-shadow dark:card-shadow-dark px-3 py-4 text-gray-700 dark:text-dark sm:px-5 md:px-6 md:py-6"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-medium text-gray-800 dark:text-dark">
          评论
          {loadState === 'ready' && (
            <span className="ml-1.5 text-sm font-normal text-gray-500 dark:text-dark-light">
              {visibleCount}
            </span>
          )}
        </h2>
        <div role="group" aria-label="评论排序" className="flex items-center gap-1 text-sm">
          {COMMENT_SORTS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => changeSort(value)}
              className={`rounded px-2 py-0.5 transition-colors ${
                sort === value
                  ? 'bg-gray-100 text-gray-800 dark:bg-dark-light dark:text-dark-hover'
                  : 'text-gray-500 hover:text-gray-800 dark:text-dark-light dark:hover:text-dark-hover'
              }`}
            >
              {SORT_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <CommentForm {...formProps} />

      <p
        role="status"
        aria-live="polite"
        className={notice ? 'mt-3 text-sm text-green-600 dark:text-green-400' : 'sr-only'}
      >
        {notice}
      </p>
      {actionError && (
        <p role="alert" className="mt-3 text-sm text-red-500">
          {actionError}
        </p>
      )}

      <div
        aria-busy={fetching}
        className={`mt-4 border-t border-gray-200 pt-2 transition-opacity dark:border-dark-2 ${
          fetching && loadState === 'ready' ? 'opacity-60' : ''
        }`}
      >
        {loadState === 'loading' && (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-dark-400">评论加载中…</p>
        )}
        {loadState === 'error' && (
          <div className="py-6 text-center text-sm text-gray-500 dark:text-dark-light">
            <p>评论加载失败：{loadError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-2 rounded border border-gray-200 px-3 py-1 hover:text-blue-600 dark:border-dark-2 dark:hover:text-blue-400"
            >
              重试
            </button>
          </div>
        )}
        {loadState === 'ready' && items.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-dark-400">
            还没有评论，来说两句吧
          </p>
        )}
        {loadState === 'ready' && items.length > 0 && (
          <ol className="list-none divide-y divide-gray-100 p-0 dark:divide-gray-800">
            {items.map((root) => (
              <li key={root.id} className="py-3">
                {renderItem(
                  root,
                  false,
                  root.replies && root.replies.length > 0 ? (
                    <ol className="mt-2 list-none space-y-2 border-l-2 border-gray-100 p-0 pl-3 dark:border-gray-800">
                      {root.replies.map((reply) => (
                        <li key={reply.id}>{renderItem(reply, true)}</li>
                      ))}
                    </ol>
                  ) : null,
                )}
              </li>
            ))}
          </ol>
        )}
        {loadState === 'ready' && data?.repliesTruncated && (
          <p className="pt-2 text-xs text-gray-400 dark:text-dark-400">
            本页回复较多，部分回复未显示
          </p>
        )}
      </div>

      {loadState === 'ready' && totalPages > 1 && (
        <nav aria-label="评论分页" className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            className="rounded border border-gray-200 px-3 py-1 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-2 dark:hover:text-blue-400"
          >
            上一页
          </button>
          <span className="text-gray-500 dark:text-dark-light" aria-current="page">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => changePage(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-gray-200 px-3 py-1 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-2 dark:hover:text-blue-400"
          >
            下一页
          </button>
        </nav>
      )}
    </section>
  );
}
