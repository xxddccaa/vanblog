import React from "react";
import AuthorCard, { AuthorCardProps } from "../../../../../components/AuthorCard";
import ArchiveMonthPage from "../../../../../components/ArchiveMonthPage";
import Layout from "../../../../../components/Layout";
import { Article } from "../../../../../types/article";
import { LayoutProps } from "../../../../../utils/getLayoutProps";
import { getTagArchiveMonthPageProps } from "../../../../../utils/getPageProps";
import { revalidate } from "../../../../../utils/loadConfig";
import { formatArchiveMonthLabel } from "../../../../../utils/archive";

export interface TagArchiveMonthPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  tag: string;
  year: string;
  month: string;
  articles: Article[];
}

const TagArchiveMonthPage = (props: TagArchiveMonthPageProps) => {
  const label = formatArchiveMonthLabel(props.year, props.month);

  return (
    <Layout
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      title={`${props.tag} - ${label}`}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveMonthPage
        title={`${props.tag} · ${label}`}
        description={`查看 ${props.tag} 标签在 ${label} 发布的全部文章。`}
        articles={props.articles}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default TagArchiveMonthPage;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: TagArchiveMonthPageProps; revalidate?: number }> {
  return {
    props: await getTagArchiveMonthPageProps(
      decodeURIComponent(params.tag),
      String(params.year),
      String(params.month)
    ),
    ...revalidate,
  };
}
