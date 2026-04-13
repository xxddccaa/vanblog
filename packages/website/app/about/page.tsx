import AboutPage, { getStaticProps } from '../../page-modules/about';


export default async function AboutRoute() {
  const { props } = await getStaticProps();
  return <AboutPage {...props} />;
}
