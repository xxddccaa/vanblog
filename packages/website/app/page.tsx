import Home, { getStaticProps } from '../page-modules/index';


export default async function HomePage() {
  const { props } = await getStaticProps();
  return <Home {...props} />;
}
