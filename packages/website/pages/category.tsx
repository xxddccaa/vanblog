import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import CategoryPageComponent from "../components/CategoryPage";
import { CategorySummaryItem } from "../api/getArticles";
import { LayoutProps } from "../utils/getLayoutProps";
import { getCategoryPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";

export interface CategoryPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  summaries: CategorySummaryItem[];
  wordTotal: number;
}
const CategoryPage = (props: CategoryPageProps) => {
  return (
    <Layout
      option={props.layoutProps}
      title="分类"
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <CategoryPageComponent
        summaries={props.summaries}
        authorCardProps={props.authorCardProps}
        wordTotal={props.wordTotal}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
        showTags={true}
      />
    </Layout>
  );
};

export default CategoryPage;
export async function getStaticProps(): Promise<{
  props: CategoryPageProps;
  revalidate?: number;
}> {
  return {
    props: await getCategoryPageProps(),
    ...revalidate,
  };
}
