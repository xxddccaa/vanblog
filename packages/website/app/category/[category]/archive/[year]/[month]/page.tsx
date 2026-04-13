import CategoryArchiveMonthPage, { getStaticPaths, getStaticProps } from '../../../../../../page-modules/category/[category]/archive/[year]/[month]';
import { toStaticParams } from '../../../../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function CategoryArchiveMonthRoute({ params }: { params: Promise<{ category: string; year: string; month: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <CategoryArchiveMonthPage {...props} />;
}
