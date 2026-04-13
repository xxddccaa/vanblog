import TagPage from '../../page-components/tag';
import { getTagPageProps } from '../../utils/getPageProps';


export default async function TagRoute() {
  const props = await getTagPageProps();
  return <TagPage {...props} />;
}
