import CategoryArchivePage, { getStaticPaths, getStaticProps } from '../../../page-modules/category/[category]';
import { toStaticParams } from '../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function CategoryArchiveRoute({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <CategoryArchivePage {...props} />;
}
