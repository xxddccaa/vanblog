import React from "react";
import AuthorCard, { AuthorCardProps } from "../../../components/AuthorCard";
import ArchiveMonthPage from "../../../components/ArchiveMonthPage";
import Layout from "../../../components/Layout";
import { Article } from "../../../types/article";
import { LayoutProps } from "../../../utils/getLayoutProps";
import { getArchiveMonthPageProps } from "../../../utils/getPageProps";
import { revalidate } from "../../../utils/loadConfig";
import { formatArchiveMonthLabel } from "../../../utils/archive";

export interface ArchiveMonthRouteProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  articles: Article[];
  year: string;
  month: string;
}

const ArchiveMonthRoute = (props: ArchiveMonthRouteProps) => {
  const label = formatArchiveMonthLabel(props.year, props.month);

  return (
    <Layout
      option={props.layoutProps}
      title={label}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveMonthPage
        title={label}
        description={`查看 ${label} 发布的全部文章。`}
        articles={props.articles}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default ArchiveMonthRoute;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: ArchiveMonthRouteProps; revalidate?: number }> {
  return {
    props: await getArchiveMonthPageProps(String(params.year), String(params.month)),
    ...revalidate,
  };
}
