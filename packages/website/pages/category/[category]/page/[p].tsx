import CategoryPages, { CategoryPagesProps } from "../../[category]";
import { getCategoryPagesProps } from "../../../../utils/getPageProps";
import { revalidate } from "../../../../utils/loadConfig";

export default CategoryPages;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({
  params,
}: any): Promise<{ props: CategoryPagesProps; revalidate?: number }> {
  const decodedCategory = decodeURIComponent(params.category);
  const currPage = parseInt(params.p) || 1;
  return {
    props: await getCategoryPagesProps(decodedCategory, currPage),
    ...revalidate,
  };
}
