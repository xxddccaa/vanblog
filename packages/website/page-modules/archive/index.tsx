import React from "react";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import ArchiveSummaryPage from "../../components/ArchiveSummaryPage";
import Layout from "../../components/Layout";
import { ArchiveSummaryData } from "../../api/getArticles";
import { LayoutProps } from "../../utils/getLayoutProps";
import { getArchivePageProps } from "../../utils/getPageProps";
import { revalidate } from "../../utils/loadConfig";
import { getArchiveBasePath } from "../../utils/archive";

export interface ArchivePageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  summary: ArchiveSummaryData;
}

const ArchivePage = (props: ArchivePageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      title="归档"
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveSummaryPage
        title="归档"
        description="按年与月份查看全站稳定归档。"
        summary={props.summary}
        basePath={getArchiveBasePath()}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default ArchivePage;

export async function getStaticProps(): Promise<{ props: ArchivePageProps; revalidate?: number }> {
  return {
    props: await getArchivePageProps(),
    ...revalidate,
  };
}
