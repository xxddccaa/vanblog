import React from "react";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import ArchiveSummaryPage from "../../components/ArchiveSummaryPage";
import Layout from "../../components/Layout";
import { ArchiveSummaryData } from "../../api/getArticles";
import { LayoutProps } from "../../utils/getLayoutProps";
import { getCategoryArchivePageProps } from "../../utils/getPageProps";
import { revalidate } from "../../utils/loadConfig";
import { getCategoryArchiveBasePath } from "../../utils/archive";
import { getPublicMeta } from "../../api/getAllData";

export interface CategoryArchivePageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  category: string;
  summary: ArchiveSummaryData;
}

const CategoryArchivePage = (props: CategoryArchivePageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      title={props.category}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveSummaryPage
        title={props.category}
        description={`按月份查看 ${props.category} 分类下的稳定归档。`}
        summary={props.summary}
        basePath={getCategoryArchiveBasePath(props.category)}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default CategoryArchivePage;

export async function getStaticPaths() {
  const data = await getPublicMeta();
  const paths = data.meta.categories.map((category) => ({
    params: {
      category,
    },
  }));

  return {
    paths,
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: CategoryArchivePageProps; revalidate?: number }> {
  return {
    props: await getCategoryArchivePageProps(decodeURIComponent(params.category)),
    ...revalidate,
  };
}
