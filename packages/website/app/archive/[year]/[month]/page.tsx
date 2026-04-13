import ArchiveMonthPage, { getStaticPaths, getStaticProps } from '../../../../page-modules/archive/[year]/[month]';
import { toStaticParams } from '../../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function ArchiveMonthRoute({ params }: { params: Promise<{ year: string; month: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <ArchiveMonthPage {...props} />;
}
