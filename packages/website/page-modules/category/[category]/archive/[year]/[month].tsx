import React from "react";
import AuthorCard, { AuthorCardProps } from "../../../../../components/AuthorCard";
import ArchiveMonthPage from "../../../../../components/ArchiveMonthPage";
import Layout from "../../../../../components/Layout";
import { Article } from "../../../../../types/article";
import { LayoutProps } from "../../../../../utils/getLayoutProps";
import { getCategoryArchiveMonthPageProps } from "../../../../../utils/getPageProps";
import { revalidate } from "../../../../../utils/loadConfig";
import { formatArchiveMonthLabel } from "../../../../../utils/archive";

export interface CategoryArchiveMonthPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  category: string;
  year: string;
  month: string;
  articles: Article[];
}

const CategoryArchiveMonthPage = (props: CategoryArchiveMonthPageProps) => {
  const label = formatArchiveMonthLabel(props.year, props.month);

  return (
    <Layout
      option={props.layoutProps}
      title={`${props.category} - ${label}`}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveMonthPage
        title={`${props.category} · ${label}`}
        description={`查看 ${props.category} 分类在 ${label} 发布的全部文章。`}
        articles={props.articles}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default CategoryArchiveMonthPage;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: CategoryArchiveMonthPageProps; revalidate?: number }> {
  return {
    props: await getCategoryArchiveMonthPageProps(
      decodeURIComponent(params.category),
      String(params.year),
      String(params.month)
    ),
    ...revalidate,
  };
}
