import React from "react";
import AuthorCard, { AuthorCardProps } from "../../../../components/AuthorCard";
import ArchiveSummaryPage from "../../../../components/ArchiveSummaryPage";
import Layout from "../../../../components/Layout";
import { ArchiveSummaryData } from "../../../../api/getArticles";
import { LayoutProps } from "../../../../utils/getLayoutProps";
import { getTagArchiveYearPageProps } from "../../../../utils/getPageProps";
import { revalidate } from "../../../../utils/loadConfig";
import { getTagArchiveBasePath } from "../../../../utils/archive";

export interface TagArchiveYearPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  tag: string;
  year: string;
  summary: ArchiveSummaryData;
}

const TagArchiveYearPage = (props: TagArchiveYearPageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      title={`${props.tag} - ${props.year}`}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveSummaryPage
        title={`${props.tag} · ${props.year} 年`}
        description={`查看 ${props.tag} 标签在 ${props.year} 年各月份的归档。`}
        summary={props.summary}
        basePath={getTagArchiveBasePath(props.tag)}
        selectedYear={props.year}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default TagArchiveYearPage;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: TagArchiveYearPageProps; revalidate?: number }> {
  return {
    props: await getTagArchiveYearPageProps(
      decodeURIComponent(params.tag),
      String(params.year)
    ),
    ...revalidate,
  };
}
