import TagPages, { TagPagesProps } from "../../[tag]";
import { getTagPagesProps } from "../../../../utils/getPageProps";
import { revalidate } from "../../../../utils/loadConfig";

export default TagPages;

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}

export async function getStaticProps({
  params,
}: any): Promise<{ props: TagPagesProps; revalidate?: number }> {
  const decodedTag = decodeURIComponent(params.tag);
  const currPage = parseInt(params.p) || 1;
  return {
    props: await getTagPagesProps(decodedTag, currPage),
    ...revalidate,
  };
}
