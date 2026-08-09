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

/**
 * 生成“保留 Markdown 语法”的预览片段，用于首页卡片按 Markdown 渲染。
 * 与 buildArticlePreview（纯文本，供搜索索引用）不同，这里尽量保持结构完整：
 * - 若正文含 <!-- more -->，取其之前的部分原样返回（作者显式截断点）。
 * - 否则按行边界截断，并感知代码围栏，避免把 ``` 代码块 / 行内链接图片切坏。
 */
export function buildArticleMarkdownPreview(content = '', maxLength = MARKDOWN_PREVIEW_LENGTH) {
  if (content.includes(MORE_TAG)) {
    return content.split(MORE_TAG)[0].trim();
  }

  const trimmed = content.trim();
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
