import PostPage from '../../../page-components/post/[id]';
import { getArticlesByOption } from '../../../api/getArticles';
import { getArticlePath } from '../../../utils/getArticlePath';
import { getPostPagesProps } from '../../../utils/getPageProps';

export const dynamicParams = true;

export async function generateStaticParams() {
  const data = await getArticlesByOption({
    page: 1,
    pageSize: -1,
    toListView: true,
  });
  return data.articles.map((article) => ({ id: String(getArticlePath(article)) }));
}

export default async function PostRoute({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const props = await getPostPagesProps(resolvedParams.id);
  return <PostPage {...props} />;
}
