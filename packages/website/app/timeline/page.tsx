import TimeLinePage, { getStaticProps } from '../../page-modules/timeline';


export default async function TimelineRoute() {
  const { props } = await getStaticProps();
  return <TimeLinePage {...props} />;
}
