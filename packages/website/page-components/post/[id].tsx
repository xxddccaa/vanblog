'use client';

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../../components/Layout';
import PostCard from '../../components/PostCard';
import Toc from '../../components/Toc';
import { Article } from '../../types/article';
import { getArticlePath } from '../../utils/getArticlePath';
import { LayoutProps } from '../../utils/getLayoutProps';
import { hasToc } from '../../utils/hasToc';
import { getArticlesKeyWord } from '../../utils/keywords';
import Custom404 from '../../page-modules/404';

export interface PostPagesProps {
  layoutProps: LayoutProps;
  article: Article;
  pay: string[];
  payDark: string[];
  author: string;
  showSubMenu: 'true' | 'false';
}

export default function PostPages(props: PostPagesProps) {
  const [content, setContent] = useState(props?.article?.content || '');

  useEffect(() => {
    setContent(props?.article?.content || '');
  }, [props.article]);

  if (!props.article) {
    return <Custom404 name="文章" />;
  }

  return (
    <Layout
      option={props.layoutProps}
      title={props.article.title}
      sideBar={hasToc(content) ? <Toc content={content} showSubMenu={props.showSubMenu} /> : null}
    >
      <Head>
        <meta name="keywords" content={getArticlesKeyWord([props.article]).join(',')} />
      </Head>
      <PostCard
        showEditButton={props.layoutProps.showEditButton === 'true'}
        showExpirationReminder={props.layoutProps.showExpirationReminder == 'true'}
        copyrightAggreement={props.layoutProps.copyrightAggreement}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow == 'true'}
        customCopyRight={props.article.copyright || null}
        top={props.article.top || 0}
        id={getArticlePath(props.article)}
        key={props.article.title}
        title={props.article.title}
        updatedAt={new Date(props.article.updatedAt)}
        createdAt={new Date(props.article.createdAt)}
        catelog={props.article.category}
        content={content}
        setContent={setContent}
        type="article"
        pay={props.pay}
        payDark={props.payDark}
        private={props.article.private}
        author={props.author}
        tags={props.article.tags}
        enableComment={props.layoutProps.enableComment}
        hideDonate={props.layoutProps.showDonateButton == 'false'}
        hideCopyRight={props.layoutProps.showCopyRight == 'false'}
        codeMaxLines={props.layoutProps.codeMaxLines}
      />
    </Layout>
  );
}
