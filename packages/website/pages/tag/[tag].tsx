import { getPublicMeta } from "../../api/getAllData";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import Layout from "../../components/Layout";
import TimelinePageComponent from "../../components/TimelinePage";
import { Article } from "../../types/article";
import { LayoutProps } from "../../utils/getLayoutProps";
import { getTagPagesProps } from "../../utils/getPageProps";
import { revalidate } from "../../utils/loadConfig";
import Custom404 from "../404";
export interface TagPagesProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  currTag: string;
  sortedArticles: Record<string, Article[]>;
  curNum: number;
  wordTotal: number;
}
const TagPages = (props: TagPagesProps) => {
  if (Object.keys(props.sortedArticles).length == 0) {
    return <Custom404 name="标签" />;
  }
  return (
    <Layout
      option={props.layoutProps}
      title={props.currTag}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <TimelinePageComponent
        sortedArticles={props.sortedArticles}
        authorCardProps={props.authorCardProps}
        wordTotal={props.wordTotal}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
        pageTitle={props.currTag}
        pageSubtitle={`${props.curNum} 文章 × ${props.wordTotal} 字`}
      />
    </Layout>
  );
};

export default TagPages;
export async function getStaticPaths() {
  const data = await getPublicMeta();
  const paths = data.tags.map((tag) => ({
    params: {
      tag: tag,
    },
  }));
  return {
    paths,
    fallback: "blocking",
  };
}
export async function getStaticProps({
  params,
}: any): Promise<{ props: TagPagesProps; revalidate?: number }> {
  return {
    props: await getTagPagesProps(params.tag),
    ...revalidate,
  };
}
