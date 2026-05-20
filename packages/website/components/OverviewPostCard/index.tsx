import React from 'react';
import dayjs from 'dayjs';
import Link from 'next/link';
import { encodeQuerystring } from '../../utils/encode';
import { getOverviewPreview } from '../../utils/getOverviewPreview';
import { getTarget } from '../Link/tools';
import TopPinIcon from '../TopPinIcon';

export default function OverviewPostCard(props: {
  id: number | string;
  title: string;
  updatedAt: Date;
  createdAt: Date;
  catelog: string;
  categories?: string[];
  content: string;
  private: boolean;
  top: number;
  enableComment: 'true' | 'false';
  openArticleLinksInNewWindow: boolean;
  showEditButton: boolean;
  showExpirationReminder: boolean;
}) {
  const summary = props.private
    ? '该文章已加密，点击 `阅读全文` 并输入密码后方可查看。'
    : getOverviewPreview(props.content || '');
  const categories =
    Array.isArray(props.categories) && props.categories.length
      ? props.categories
      : props.catelog
        ? [props.catelog]
        : [];

  return (
    <div className="post-card-wrapper">
      <div
        style={{ position: 'relative' }}
        id="post-card"
        className="overflow-hidden post-card vb-surface-card card-shadow py-4 px-1 sm:px-3 md:py-6 md:px-5 dark:nav-shadow-dark"
      >
        {props.top !== 0 ? <TopPinIcon /> : null}

        <div className="flex justify-center post-card-title">
          <Link
            href={`/post/${props.id}`}
            target={getTarget(props.openArticleLinksInNewWindow)}
            style={{ width: '90%' }}
            title={props.title}
          >
            <div className="ua ua-link mt-2 mb-2 block cursor-pointer px-5 text-center text-lg font-medium whitespace-normal break-words text-gray-700 dark:text-dark md:text-xl">
              {props.title}
            </div>
          </Link>
        </div>

        <div className="post-card-sub-title text-center text-xs text-gray-400 divide-x divide-gray-400 dark:text-dark md:text-sm">
          <span className="inline-flex items-center px-2">
            {dayjs(props.createdAt).format('YYYY-MM-DD')}
          </span>
          {categories.length ? (
            <span className="inline-flex items-center px-2">
              <span className="inline-flex flex-wrap justify-center gap-x-2 gap-y-1">
                {categories.map((category) => (
                  <Link
                    key={`category-${category}`}
                    href={`/category/${encodeQuerystring(category)}`}
                    target={getTarget(props.openArticleLinksInNewWindow)}
                    className="cursor-pointer text-blue-500 transition hover:text-blue-600 hover:font-medium dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {category}
                  </Link>
                ))}
              </span>
            </span>
          ) : null}
        </div>

        <div className="mx-2 mt-4 text-sm text-gray-600 md:text-base">
          <p className="leading-7 whitespace-pre-line break-words text-gray-600 dark:text-dark">
            {summary}
          </p>
        </div>

        <div className="mt-4 flex w-full justify-center">
          <Link href={`/post/${props.id}`} target={getTarget(props.openArticleLinksInNewWindow)}>
            <div className="rounded border-2 border-gray-800 px-2 py-1 text-sm text-gray-700 transition-all hover:bg-gray-800 hover:text-gray-50 dark:border-dark dark:bg-dark dark:text-dark dark:hover:bg-dark-light dark:hover:text-dark-r md:text-base">
              阅读全文
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
