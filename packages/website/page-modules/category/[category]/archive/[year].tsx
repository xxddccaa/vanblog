import React from "react";
import AuthorCard, { AuthorCardProps } from "../../../../components/AuthorCard";
import ArchiveSummaryPage from "../../../../components/ArchiveSummaryPage";
import Layout from "../../../../components/Layout";
import { ArchiveSummaryData } from "../../../../api/getArticles";
import { LayoutProps } from "../../../../utils/getLayoutProps";
import { getCategoryArchiveYearPageProps } from "../../../../utils/getPageProps";
import { revalidate } from "../../../../utils/loadConfig";
import { getCategoryArchiveBasePath } from "../../../../utils/archive";

export interface CategoryArchiveYearPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  category: string;
  year: string;
  summary: ArchiveSummaryData;
}

const CategoryArchiveYearPage = (props: CategoryArchiveYearPageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      title={`${props.category} - ${props.year}`}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <ArchiveSummaryPage
        title={`${props.category} · ${props.year} 年`}
        description={`查看 ${props.category} 分类在 ${props.year} 年各月份的归档。`}
        summary={props.summary}
        basePath={getCategoryArchiveBasePath(props.category)}
        selectedYear={props.year}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
      />
    </Layout>
  );
};

export default CategoryArchiveYearPage;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }: any): Promise<{ props: CategoryArchiveYearPageProps; revalidate?: number }> {
  return {
    props: await getCategoryArchiveYearPageProps(
      decodeURIComponent(params.category),
      String(params.year)
    ),
    ...revalidate,
  };
}
