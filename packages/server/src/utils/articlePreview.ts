const MORE_TAG = '<!-- more -->';
const DEFAULT_PREVIEW_LENGTH = 220;

function stripMarkdown(content: string) {
  return content
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildArticlePreview(content = '', maxLength = DEFAULT_PREVIEW_LENGTH) {
  const source = content.includes(MORE_TAG) ? content.split(MORE_TAG)[0] : content;
  const preview = stripMarkdown(source);

  if (preview.length <= maxLength) {
    return preview;
  }

  return `${preview.slice(0, maxLength).trimEnd()}...`;
}

const MARKDOWN_PREVIEW_LENGTH = 300;
const CODE_FENCE = /^\s*(?:```|~~~)/;
const LIST_MARKER = /^(\s*)(?:[-+*]|\d+[.)])\s+/;

/**
 * Markdown editors commonly persist a small amount of indentation before every
 * top-level list marker. That indentation is significant to Markdown parsers
 * and can make a preview look like a nested list. Remove only the common
 * indentation shared by list markers, preserving relative indentation for
 * nested items and leaving fenced code untouched.
 */
function normalizePreviewListIndentation(content: string) {
  const lines = content.split('\n');
  const listLines: Array<{ index: number; indent: number }> = [];
  let inFence = false;

  lines.forEach((line, index) => {
    if (CODE_FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = line.match(LIST_MARKER);
    if (match) {
      listLines.push({ index, indent: match[1].length });
    }
  });

  if (listLines.length === 0) {
    return content;
  }

  const groups: Array<Array<{ index: number; indent: number }>> = [];
  listLines.forEach((item) => {
    const current = groups[groups.length - 1];
    if (!current || item.index > current[current.length - 1].index + 1) {
      groups.push([item]);
    } else {
      current.push(item);
    }
  });

  for (const group of groups) {
    const commonIndent = Math.min(...group.map(({ indent }) => indent));
    // CommonMark permits up to three spaces before a top-level block marker.
    // Four or more spaces can be an indented code block and must be preserved.
    if (commonIndent <= 0 || commonIndent > 3) {
      continue;
    }
    group.forEach(({ index }) => {
      lines[index] = lines[index].slice(commonIndent);
    });
  }

  return lines.join('\n');
}

/**
 * 生成“保留 Markdown 语法”的预览片段，用于首页卡片按 Markdown 渲染。
 * 与 buildArticlePreview（纯文本，供搜索索引用）不同，这里尽量保持结构完整：
 * - 若正文含 <!-- more -->，取其之前的部分原样返回（作者显式截断点）。
 * - 否则按行边界截断，并感知代码围栏，避免把 ``` 代码块 / 行内链接图片切坏。
 */
export function buildArticleMarkdownPreview(content = '', maxLength = MARKDOWN_PREVIEW_LENGTH) {
  const source = content.includes(MORE_TAG) ? content.split(MORE_TAG)[0] : content;
  const trimmed = normalizePreviewListIndentation(source).trim();
  if (content.includes(MORE_TAG)) {
    return trimmed;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
  const kept: string[] = [];
  let count = 0;
  let inFence = false;
  let truncated = false;

  for (const line of lines) {
    // 仅在“不处于围栏内且已达长度”时于行边界停止，保证不切断代码块中途。
    if (!inFence && count >= maxLength) {
      truncated = true;
      break;
    }
    if (CODE_FENCE.test(line)) {
      inFence = !inFence;
    }
    kept.push(line);
    count += line.length + 1;
  }

  // 兜底：截断后若仍处于未闭合围栏，补齐结尾。
  if (inFence) {
    kept.push('```');
  }

  let preview = kept.join('\n').trim();
  if (truncated) {
    preview = `${preview}\n\n...`;
  }
  return preview;
}
