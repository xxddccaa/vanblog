const MORE_TAG = "<!-- more -->";
const DEFAULT_PREVIEW_LENGTH = 220;

function stripMarkdown(content: string) {
  return content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getOverviewPreview(content = "", maxLength = DEFAULT_PREVIEW_LENGTH) {
  const source = content.includes(MORE_TAG) ? content.split(MORE_TAG)[0] : content;
  const preview = stripMarkdown(source);

  if (preview.length <= maxLength) {
    return preview;
  }

  return `${preview.slice(0, maxLength).trimEnd()}...`;
}
