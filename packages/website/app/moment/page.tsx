import MomentPage from '../../page-components/moment';
import { getMomentPageProps } from '../../utils/getPageProps';
import { renderMarkdownToHtml } from '../../utils/renderMarkdown';

export const revalidate = 60;

export default async function MomentRoute() {
  const props = await getMomentPageProps();
  return (
    <MomentPage
      {...props}
      initialMoments={props.initialMoments.map((moment) => ({
        ...moment,
        initialRenderedHtml: renderMarkdownToHtml(
          moment.content,
          props.codeMaxLines,
        ),
      }))}
    />
  );
}
