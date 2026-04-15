import React from "react";
import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import { TimelineSummaryItem } from "../api/getArticles";
import Layout from "../components/Layout";
import TimelinePageComponent from "../components/TimelinePage";
import { LayoutProps } from "../utils/getLayoutProps";
import { getTimeLinePageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
export interface TimeLinePageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  summaries: TimelineSummaryItem[];
}
const TimeLine = (props: TimeLinePageProps) => {
  return (
    <Layout
      title={"时间线"}
      option={props.layoutProps}
      contentWidthMode={props.layoutProps.articleWidthMode}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <TimelinePageComponent
        summaries={props.summaries}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
        pageTitle="时间线"
      />
    </Layout>
  );
};

export default TimeLine;
export async function getStaticProps(): Promise<{
  props: TimeLinePageProps;
  revalidate?: number;
}> {
  return {
    props: await getTimeLinePageProps(),
    ...revalidate,
  };
}
