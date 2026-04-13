import TagArchiveYearPage, { getStaticPaths, getStaticProps } from '../../../../../page-modules/tag/[tag]/archive/[year]';
import { toStaticParams } from '../../../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function TagArchiveYearRoute({ params }: { params: Promise<{ tag: string; year: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <TagArchiveYearPage {...props} />;
}
