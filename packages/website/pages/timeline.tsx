import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import TimelinePageComponent from "../components/TimelinePage";
import { Article } from "../types/article";
import { LayoutProps } from "../utils/getLayoutProps";
import { getTimeLinePageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
export interface TimeLinePageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  sortedArticles: Record<string, Article[]>;
  wordTotal: number;
}
const TimeLine = (props: TimeLinePageProps) => {
  return (
    <Layout
      title={"时间线"}
      option={props.layoutProps}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <TimelinePageComponent
        sortedArticles={props.sortedArticles}
        authorCardProps={props.authorCardProps}
        wordTotal={props.wordTotal}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
        pageTitle="时间线"
        pageSubtitle={`${props.authorCardProps.catelogNum} 分类 × ${props.authorCardProps.postNum} 文章 × ${props.authorCardProps.tagNum} 标签 × ${props.wordTotal} 字`}
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
