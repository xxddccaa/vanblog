import TagArchivePage, { getStaticPaths, getStaticProps } from '../../../page-modules/tag/[tag]';
import { toStaticParams } from '../../route-helpers';

export const dynamicParams = true;

export async function generateStaticParams() {
  const result = await getStaticPaths();
  return toStaticParams(result.paths);
}

export default async function TagArchiveRoute({ params }: { params: Promise<{ tag: string }> }) {
  const resolvedParams = await params;
  const { props } = await getStaticProps({ params: resolvedParams });
  return <TagArchivePage {...props} />;
}
