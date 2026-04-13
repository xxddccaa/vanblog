import LinkPage from '../../page-components/link';
import { getLinkPageProps } from '../../utils/getPageProps';


export default async function LinkRoute() {
  const props = await getLinkPageProps();
  return <LinkPage {...props} />;
}
