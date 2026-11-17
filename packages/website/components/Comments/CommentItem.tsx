import React from 'react';
import type { PublicComment } from '../../api/comments';
import CommentMarkdown from '../CommentMarkdown';
import {
  avatarColor,
  avatarLetter,
  displayNick,
  formatFullTime,
  formatRelativeTime,
  normalizeHomepage,
} from './utils';

export function LetterAvatar({ nick, small = false }: { nick: string; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-shrink-0 select-none items-center justify-center rounded-full font-medium text-white ${
        small ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
      }`}
      style={{ backgroundColor: avatarColor(nick) }}
    >
      {avatarLetter(nick)}
    </span>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'amber' | 'gray' }) {
  const tones = {
    blue: 'border-blue-300 text-blue-600 dark:border-blue-400 dark:text-blue-300',
    amber: 'border-amber-300 text-amber-600 dark:border-amber-400 dark:text-amber-300',
    gray: 'border-gray-300 text-gray-500 dark:border-dark dark:text-dark-light',
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1 text-xs leading-5 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17 4 12l5-5M4 12h9a7 7 0 0 1 7 7" />
    </svg>
  );
}

export interface CommentItemProps {
  comment: PublicComment;
  /** True for replies rendered under a root comment. */
  nested?: boolean;
  liked: boolean;
  likeBusy: boolean;
  pending: boolean;
  highlighted: boolean;
  now: number;
  onLike: (comment: PublicComment) => void;
  onReply: (comment: PublicComment) => void;
  /** Inline reply form, rendered right below this comment. */
  replyForm?: React.ReactNode;
  children?: React.ReactNode;
}

export default function CommentItem(props: CommentItemProps) {
  const { comment, nested = false } = props;
  const anchorId = `comment-${comment.id}`;
  const className = `vb-comment-item${props.highlighted ? ' vb-comment-highlight' : ''}`;

  if (comment.deleted) {
    return (
      <article id={anchorId} className={className} data-comment-id={comment.id}>
        <div className="flex gap-3 py-1">
          <span
            aria-hidden="true"
            className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-400 dark:bg-dark-light dark:text-dark-400 ${
              nested ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
            }`}
          >
            ?
          </span>
          <div className="min-w-0 flex-1">
            <p className="py-1 text-sm italic text-gray-400 dark:text-dark-400">该评论已删除</p>
            {props.children}
          </div>
        </div>
      </article>
    );
  }

  const nick = displayNick(comment.nick);
  const homepage = normalizeHomepage(comment.link);
  const isReplyToReply =
    nested &&
    comment.parentId !== null &&
    comment.rootId !== null &&
    comment.parentId !== comment.rootId;
  const meta = [comment.location, comment.browser, comment.os].filter(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  const fullTime = formatFullTime(comment.createdAt);

  return (
    <article id={anchorId} className={className} data-comment-id={comment.id}>
      <div className="flex gap-3 py-1">
        <LetterAvatar nick={comment.nick} small={nested} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {homepage ? (
              <a
                href={homepage}
                target="_blank"
                rel="nofollow ugc noopener noreferrer"
                className="font-medium text-gray-800 hover:text-blue-600 dark:text-dark dark:hover:text-blue-400"
              >
                {nick}
              </a>
            ) : (
              <span className="font-medium text-gray-800 dark:text-dark">{nick}</span>
            )}
            {comment.isAdmin && <Badge tone="blue">博主</Badge>}
            {comment.pinned && !nested && <Badge tone="amber">置顶</Badge>}
            {props.pending && <Badge tone="gray">待审核</Badge>}
            {isReplyToReply && (
              <span className="text-xs text-gray-500 dark:text-dark-light">
                回复 @{displayNick(comment.replyToNick)}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400 dark:text-dark-400">
            <a
              href={`#${anchorId}`}
              className="hover:text-blue-600 dark:hover:text-blue-400"
              title={fullTime}
            >
              <time dateTime={comment.createdAt}>
                {formatRelativeTime(comment.createdAt, props.now)}
              </time>
            </a>
            {meta.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
          <div className="mt-1.5 text-gray-700 dark:text-dark">
            <CommentMarkdown content={comment.content} />
          </div>
          {!props.pending && (
            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-dark-light">
              <button
                type="button"
                onClick={() => props.onLike(comment)}
                disabled={props.likeBusy}
                aria-pressed={props.liked}
                aria-label={`${props.liked ? '取消点赞' : '点赞'}，当前 ${comment.likes} 个赞`}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded px-1 transition-colors hover:text-rose-500 disabled:cursor-wait disabled:opacity-60 ${
                  props.liked ? 'text-rose-500' : ''
                }`}
              >
                <HeartIcon filled={props.liked} />
                <span aria-hidden="true">{comment.likes > 0 ? comment.likes : '赞'}</span>
              </button>
              <button
                type="button"
                onClick={() => props.onReply(comment)}
                aria-label={`回复 ${nick}`}
                className="inline-flex min-h-[28px] items-center gap-1 rounded px-1 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
              >
                <ReplyIcon />
                <span aria-hidden="true">回复</span>
              </button>
            </div>
          )}
          {props.replyForm}
          {props.children}
        </div>
      </div>
    </article>
  );
}
