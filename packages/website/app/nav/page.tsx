import NavPage from '../../page-components/nav';
import { getNavPageProps } from '../../utils/getPageProps';

export const revalidate = 60;

export default async function NavRoute() {
  const props = await getNavPageProps();
  return <NavPage {...props} />;
}
