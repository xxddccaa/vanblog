import LinkPage from '../../page-components/link';
import { getLinkPageProps } from '../../utils/getPageProps';
import { renderMarkdownToHtml } from '../../utils/renderMarkdown';
import { buildLinkRequirementMarkdown } from '../../utils/linkRequirement';


export default async function LinkRoute() {
  const props = await getLinkPageProps();
  const logo =
    props.layoutProps.logo || props.authorCardProps.logo || '/logo.svg';
  return (
    <LinkPage
      {...props}
      initialRenderedHtml={renderMarkdownToHtml(
        buildLinkRequirementMarkdown({
          siteName: props.layoutProps.siteName,
          description: props.layoutProps.description,
          logo,
        }),
        props.layoutProps.codeMaxLines,
      )}
    />
  );
}
