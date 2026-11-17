'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { isCommentTargetKey, type CommentTargetKey } from '../../api/comments';

function CommentPlaceholder() {
  return (
    <div className="mt-4 vb-surface-card card-shadow dark:card-shadow-dark px-3 py-6 text-center text-sm text-gray-400 dark:text-dark-400 sm:px-5 md:px-6">
      评论加载中…
    </div>
  );
}

// Comments are client-only: identity, likes and the visitor profile are per
// browser and must never end up in statically rendered or CDN-cached HTML.
const CommentSection = dynamic(() => import('./core'), {
  ssr: false,
  loading: () => <CommentPlaceholder />,
});

/** Start loading this far before the section scrolls into view. */
const PRELOAD_MARGIN = '600px 0px';

const wantsCommentsNow = () => /^#comments?(-\d+)?$/.test(window.location.hash);

/**
 * Defers the comment bundle (Markdown, KaTeX, highlighting) and the list
 * request until the reader approaches the section, or immediately for a
 * `#comments` / `#comment-<id>` deep link.
 */
function DeferredCommentSection({ target }: { target: CommentTargetKey }) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) {
      return undefined;
    }
    if (wantsCommentsNow() || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }
    const onHashChange = () => {
      if (wantsCommentsNow()) {
        setActive(true);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [active]);

  if (active) {
    return <CommentSection target={target} />;
  }
  return (
    <div ref={placeholderRef} id="comments">
      <CommentPlaceholder />
    </div>
  );
}

export default function Comments(props: {
  enable: 'true' | 'false' | string | undefined;
  /** `post:<article id>`, `page:link` or `page:about`. */
  target: string | null | undefined;
}) {
  if (!props.enable || props.enable === 'false' || !isCommentTargetKey(props.target)) {
    return null;
  }
  // Keyed by target so client-side navigation never carries a draft or reply over.
  return <DeferredCommentSection key={props.target} target={props.target} />;
}
