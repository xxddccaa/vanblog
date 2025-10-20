import { getPublicMeta } from "../../api/getAllData";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import Layout from "../../components/Layout";
import TimelinePageComponent from "../../components/TimelinePage";
import ArticleList from "../../components/ArticleList";
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
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-2">
            {props.curCategory}
          </h1>
          <div className="text-center text-gray-600 text-sm font-light dark:text-dark">
            {`${props.curNum} 文章 × ${props.wordTotal} 字`}
          </div>
        </div>

        <ArticleList
          articles={props.sortedArticles[props.curCategory] || []}
          showYear={false}
          openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
          showTags={true}
        />
      </div>
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
  // 解码URL参数中的分类名称
  const decodedCategory = decodeURIComponent(params.category);
  return {
    props: await getCategoryPagesProps(decodedCategory),
    ...revalidate,
  };
}
