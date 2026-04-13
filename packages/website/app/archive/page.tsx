import ArchivePage, { getStaticProps } from '../../page-modules/archive';


export default async function ArchiveRoute() {
  const { props } = await getStaticProps();
  return <ArchivePage {...props} />;
}
