import { getPublicMeta } from "../../api/getAllData";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import Layout from "../../components/Layout";
import TimelinePageComponent from "../../components/TimelinePage";
import { Article } from "../../types/article";
import { LayoutProps } from "../../utils/getLayoutProps";
import { getCategoryPagesProps } from "../../utils/getPageProps";
import { revalidate } from "../../utils/loadConfig";
export interface CategoryPagesProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  curCategory: string;
  sortedArticles: Record<string, Article[]>;
  curNum: number;
  wordTotal: number;
}
const CategoryPages = (props: CategoryPagesProps) => {
  return (
    <Layout
      option={props.layoutProps}
      title={props.curCategory}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <TimelinePageComponent
        sortedArticles={props.sortedArticles}
        authorCardProps={props.authorCardProps}
        wordTotal={props.wordTotal}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
        pageTitle={props.curCategory}
        pageSubtitle={`${props.curNum} 文章 × ${props.wordTotal} 字`}
      />
    </Layout>
  );
};

export default CategoryPages;
export async function getStaticPaths() {
  const data = await getPublicMeta();

  const paths = data.meta.categories.map((category) => ({
    params: {
      category: category,
    },
  }));

  return {
    paths,
    fallback: "blocking",
  };
}
export async function getStaticProps({
  params,
}: any): Promise<{ props: CategoryPagesProps; revalidate?: number }> {
  return {
    props: await getCategoryPagesProps(params.category),
    ...revalidate,
  };
}
