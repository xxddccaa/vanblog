import ArchiveYearPage, { getStaticPaths, getStaticProps } from '../../../page-modules/archive/[year]';
import { toStaticParams } from '../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function ArchiveYearRoute({ params }: { params: Promise<{ year: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <ArchiveYearPage {...props} />;
}
