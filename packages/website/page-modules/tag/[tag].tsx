import React from "react";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import ArchiveSummaryPage from "../../components/ArchiveSummaryPage";
import Layout from "../../components/Layout";
import { ArchiveSummaryData } from "../../api/getArticles";
import { LayoutProps } from "../../utils/getLayoutProps";
import { getTagArchivePageProps } from "../../utils/getPageProps";
import { revalidate } from "../../utils/loadConfig";
import { getTagArchiveBasePath } from "../../utils/archive";
import { getPublicMeta } from "../../api/getAllData";

export interface TagArchivePageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  tag: string;
  summary: ArchiveSummaryData;
}

const TagArchivePage = (props: TagArchivePageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      title={props.tag}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveSummaryPage
        title={props.tag}
        description={`按月份查看 ${props.tag} 标签下的稳定归档。`}
        summary={props.summary}
        basePath={getTagArchiveBasePath(props.tag)}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default TagArchivePage;

export async function getStaticPaths() {
  const data = await getPublicMeta();
  const paths = data.tags.map((tag) => ({
    params: {
      tag,
    },
  }));
  return {
    paths,
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: TagArchivePageProps; revalidate?: number }> {
  return {
    props: await getTagArchivePageProps(decodeURIComponent(params.tag)),
    ...revalidate,
  };
}
