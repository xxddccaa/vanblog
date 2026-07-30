// 字数统计与阅读时长估算，计数口径借鉴 hexo-wordcount（Butterfly 主题同款）：
// 中文按字符数、其余语言按单词数分别统计，阅读速度也分别估算。
const CJK_REGEX = /[\u4E00-\u9FA5]/g;
const WORD_REGEX = /[a-zA-Z0-9_\u0392-\u03C9\u0400-\u04FF]+|[\u3040-\u30FF\uAC00-\uD7A3]+|\w+/g;

// 中文 350 字/分钟、英文 160 词/分钟，取 Butterfly 主题的默认参数。
const CJK_CHARS_PER_MINUTE = 350;
const WORDS_PER_MINUTE = 160;

export interface WordCountResult {
  cjk: number;
  words: number;
  total: number;
  minutes: number;
}

// 原始内容是 markdown 而非渲染后的 HTML，先剥掉不属于正文的部分，
// 避免链接 URL、HTML 标签等把字数灌水。
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`{3,}[^\n]*/g, '');
}

export function countWords(markdown: string): WordCountResult {
  if (!markdown || !markdown.trim()) {
    return { cjk: 0, words: 0, total: 0, minutes: 0 };
  }
  const text = stripMarkdown(markdown);
  const cjk = (text.match(CJK_REGEX) || []).length;
  const words = (text.replace(CJK_REGEX, ' ').match(WORD_REGEX) || []).length;
  const total = cjk + words;
  const minutes =
    total === 0
      ? 0
      : Math.max(1, Math.ceil(cjk / CJK_CHARS_PER_MINUTE + words / WORDS_PER_MINUTE));
  return { cjk, words, total, minutes };
}

export function formatWordCount(total: number): string {
  if (total < 1000) return String(total);
  return `${Math.round(total / 100) / 10}k`;
}
