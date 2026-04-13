import CategoryPage, { getStaticProps } from '../../page-modules/category';


export default async function CategoryRoute() {
  const { props } = await getStaticProps();
  return <CategoryPage {...props} />;
}
