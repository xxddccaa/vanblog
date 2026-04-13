import React from "react";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import ArchiveSummaryPage from "../../components/ArchiveSummaryPage";
import Layout from "../../components/Layout";
import { ArchiveSummaryData } from "../../api/getArticles";
import { LayoutProps } from "../../utils/getLayoutProps";
import { getArchiveYearPageProps } from "../../utils/getPageProps";
import { revalidate } from "../../utils/loadConfig";
import { getArchiveBasePath } from "../../utils/archive";

export interface ArchiveYearPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  summary: ArchiveSummaryData;
  year: string;
}

const ArchiveYearPage = (props: ArchiveYearPageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      title={`${props.year} 年归档`}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveSummaryPage
        title={`${props.year} 年归档`}
        description={`查看 ${props.year} 年各月份的稳定归档入口。`}
        summary={props.summary}
        basePath={getArchiveBasePath()}
        selectedYear={props.year}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default ArchiveYearPage;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: ArchiveYearPageProps; revalidate?: number }> {
  return {
    props: await getArchiveYearPageProps(String(params.year)),
    ...revalidate,
  };
}
