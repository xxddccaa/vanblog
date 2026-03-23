import { getPublicMeta } from "../../api/getAllData";
import AuthorCard, { AuthorCardProps } from "../../components/AuthorCard";
import Layout from "../../components/Layout";
import ArticleList from "../../components/ArticleList";
import PageNav from "../../components/PageNav";
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
  currPage: number;
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
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl text-gray-700 dark:text-dark font-bold mb-2">
            {props.currTag}
          </h1>
          <div className="text-center text-gray-600 text-sm font-light dark:text-dark">
            {`${props.curNum} 文章 × ${props.wordTotal} 字`}
          </div>
        </div>

        <ArticleList
          articles={props.sortedArticles[props.currTag] || []}
          showYear={false}
          openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === "true"}
          showTags={true}
        />
        <PageNav
          total={props.curNum}
          current={props.currPage}
          base={`/tag/${props.currTag}`}
          more={`/tag/${props.currTag}/page`}
          pageSize={props.layoutProps.homePageSize || 5}
        />
      </div>
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
  const decodedTag = decodeURIComponent(params.tag);
  return {
    props: await getTagPagesProps(decodedTag, 1),
    ...revalidate,
  };
}
