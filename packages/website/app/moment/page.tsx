import MomentPage from '../../page-components/moment';
import { getMomentPageProps } from '../../utils/getPageProps';

export const revalidate = 1;

export default async function MomentRoute() {
  const props = await getMomentPageProps();
  return <MomentPage {...props} />;
}
