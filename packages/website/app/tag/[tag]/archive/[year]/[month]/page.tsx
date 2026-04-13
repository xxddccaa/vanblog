import TagArchiveMonthPage, { getStaticPaths, getStaticProps } from '../../../../../../page-modules/tag/[tag]/archive/[year]/[month]';
import { toStaticParams } from '../../../../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function TagArchiveMonthRoute({ params }: { params: Promise<{ tag: string; year: string; month: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <TagArchiveMonthPage {...props} />;
}
