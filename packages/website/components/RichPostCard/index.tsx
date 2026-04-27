'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import AlertCard from '../AlertCard';
import CopyRight from '../CopyRight';
import Reward from '../Reward';
import TopPinIcon from '../TopPinIcon';
import UnLockCard from '../UnLockCard';
import WaLine from '../WaLine';
import { PostBottom } from '../PostCard/bottom';
import PostFragments from '../PostCard/fragments';
import { SubTitle, Title } from '../PostCard/title';
import { getTarget } from '../Link/tools';
import TocMobile from '../TocMobile';
import { hasToc } from '../../utils/hasToc';
import { encodeQuerystring } from '../../utils/encode';
import RenderedMarkdown from '../RenderedMarkdown';

const MarkdownClient = dynamic(() => import('../Markdown'), {
  ssr: false,
});

export default function RichPostCard(props: {
  id: number | string;
  title: string;
  updatedAt: Date;
  createdAt: Date;
  catelog: string;
  initialContent: string;
  initialRenderedHtml: string;
  type: 'article' | 'about';
  pay?: string[];
  payDark?: string[];
  author?: string;
  tags?: string[];
  enableComment: 'true' | 'false';
  top: number;
  private: boolean;
  showDonateInAbout?: boolean;
  hideDonate?: boolean;
  hideCopyRight?: boolean;
  openArticleLinksInNewWindow: boolean;
  copyrightAggreement: string;
  customCopyRight: string | null;
  showExpirationReminder: boolean;
  showEditButton: boolean;
  codeMaxLines?: number;
}) {
  const [lock, setLock] = useState(props.private);
  const [content, setContent] = useState(props.initialContent || '');
  const [usedClientFallback, setUsedClientFallback] = useState(false);

  useEffect(() => {
    setContent(props.initialContent || '');
    setLock(props.private);
    setUsedClientFallback(false);
  }, [props.initialContent, props.private]);

  const resolvedContent = useMemo(
    () => content.replace('<!-- more -->', ''),
    [content],
  );

  const showDonate = useMemo(() => {
    if (lock || props.hideDonate || !props.pay || props.pay.length <= 0) {
      return false;
    }
    if (props.type === 'article') {
      return true;
    }
    return props.type === 'about' && props.showDonateInAbout;
  }, [lock, props.hideDonate, props.pay, props.showDonateInAbout, props.type]);

  const showToc = useMemo(() => {
    if (props.type !== 'article' || lock) {
      return false;
    }
    return hasToc(content);
  }, [content, lock, props.type]);

  const shouldUseClientMarkdown =
    usedClientFallback || !props.initialRenderedHtml || content !== props.initialContent;

  return (
    <div className="post-card-wrapper">
      <div
        style={{ position: 'relative' }}
        id="post-card"
        className="overflow-hidden post-card vb-surface-card card-shadow py-4 px-1 sm:px-3 md:py-6 md:px-5 dark:nav-shadow-dark"
      >
        {props.top !== 0 && <TopPinIcon />}
        <Title
          type={props.type}
          id={props.id}
          title={props.title}
          openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
          showEditButton={props.showEditButton}
        />

        <SubTitle
          openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
          type={props.type}
          id={props.id}
          updatedAt={props.updatedAt}
          createdAt={props.createdAt}
          catelog={props.catelog}
          enableComment={props.enableComment}
        />

        {props.type === 'article' && props.tags && props.tags.length > 0 && (
          <div className="mt-3 mb-2 flex justify-center">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {props.tags.map((tag) => (
                <Link
                  key={`article-tag-${tag}`}
                  href={`/tag/${encodeQuerystring(tag)}`}
                  target={getTarget(props.openArticleLinksInNewWindow)}
                >
                  <span className="cursor-pointer border-b border-gray-800 text-sm text-gray-800 transition-colors duration-200 hover:border-black hover:text-black dark:border-dark dark:text-dark dark:hover:border-dark-hover dark:hover:text-dark-hover">
                    {tag}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mx-2 mt-4 text-sm text-gray-600 md:text-base">
          {props.type === 'article' && (
            <AlertCard
              showExpirationReminder={props.showExpirationReminder}
              updatedAt={props.updatedAt}
              createdAt={props.createdAt}
            />
          )}
          {lock ? (
            <UnLockCard
              setLock={setLock}
              setContent={(nextContent) => {
                setUsedClientFallback(true);
                setContent(nextContent);
              }}
              id={props.id}
            />
          ) : (
            <>
              {showToc && <TocMobile content={resolvedContent} />}
              {shouldUseClientMarkdown ? (
                <MarkdownClient content={resolvedContent} codeMaxLines={props.codeMaxLines} />
              ) : (
                <RenderedMarkdown
                  html={props.initialRenderedHtml}
                  content={resolvedContent}
                  codeMaxLines={props.codeMaxLines}
                />
              )}
            </>
          )}
        </div>

        {showDonate && props.pay && (
          <Reward
            aliPay={(props.pay as any)[0]}
            weChatPay={(props.pay as any)[1]}
            aliPayDark={(props.payDark || ['', ''])[0]}
            weChatPayDark={(props.payDark || ['', ''])[1]}
            author={props.author as any}
            id={props.id}
          />
        )}
        {props.type === 'article' && !lock && !props.hideCopyRight && (
          <CopyRight
            customCopyRight={props.customCopyRight}
            author={props.author as any}
            id={props.id}
            showDonate={showDonate}
            copyrightAggreement={props.copyrightAggreement}
          />
        )}

        <PostBottom
          id={props.id}
          type={props.type}
          lock={lock}
          tags={props.tags}
          openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
        />
        {props.type === 'article' && !lock && (
          <PostFragments
            id={props.id}
            openArticleLinksInNewWindow={props.openArticleLinksInNewWindow}
          />
        )}
        <div
          style={{
            height: props.type === 'about' && !showDonate ? '16px' : '0',
          }}
        />
      </div>
      <WaLine enable={props.enableComment} visible={props.type !== 'about'} />
    </div>
  );
}
