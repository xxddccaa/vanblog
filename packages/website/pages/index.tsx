import React from "react";
import Link from "next/link";
import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import PostCard from "../components/PostCard";
import { Article } from "../types/article";
import { LayoutProps } from "../utils/getLayoutProps";
import { getIndexPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
import Head from "next/head";
import { getArticlesKeyWord } from "../utils/keywords";
import { getArticlePath } from "../utils/getArticlePath";
import { getTarget } from "../components/Link/tools";
export interface IndexPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  currPage: number;
  totalPosts: number;
  articles: Article[];
}
const Home = (props: IndexPageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      title={props.layoutProps.siteName}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <Head>
        <meta
          name="keywords"
          content={getArticlesKeyWord(props.articles).join(",")}
        ></meta>
      </Head>
      <div className="space-y-2 md:space-y-4">
        {props.articles.map((article) => (
          <PostCard
            showEditButton={props.layoutProps.showEditButton === "true"}
            setContent={() => {}}
            showExpirationReminder={
              props.layoutProps.showExpirationReminder == "true"
            }
            openArticleLinksInNewWindow={
              props.layoutProps.openArticleLinksInNewWindow == "true"
            }
            customCopyRight={null}
            private={article.private}
            top={article.top || 0}
            id={getArticlePath(article)}
            key={article.id}
            title={article.title}
            updatedAt={new Date(article.updatedAt)}
            createdAt={new Date(article.createdAt)}
            catelog={article.category}
            content={article.content || ""}
            type={"overview"}
            enableComment={props.layoutProps.enableComment}
            copyrightAggreement={props.layoutProps.copyrightAggreement}
            codeMaxLines={props.layoutProps.codeMaxLines}
          ></PostCard>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 px-5 py-4 text-center dark:border-dark-2">
        <div className="text-sm text-gray-500 dark:text-dark-light">
          首页只保留最新文章，历史内容已迁移到稳定归档页。
        </div>
        <Link
          href="/archive"
          target={getTarget(
            props.layoutProps.openArticleLinksInNewWindow == "true"
          )}
          className="mt-3 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm text-white transition hover:bg-gray-700 dark:bg-dark-hover dark:text-dark-r dark:hover:bg-dark-light"
        >
          查看全部归档
        </Link>
      </div>
    </Layout>
  );
};

export default Home;
export async function getStaticProps(): Promise<{
  props: IndexPageProps;
  revalidate?: number;
}> {
  return {
    props: await getIndexPageProps(),
    ...revalidate,
  };
}
