import type { CustomContainerType, EditorEngine, TextRange } from './types';

export const EDITOR_ENGINE_STORAGE_KEY = 'vanblog_editor_engine';
export const DEFAULT_EDITOR_ENGINE: EditorEngine = 'bytemd';
export const LAST_CODE_LANGUAGE_KEY = 'vanblog_last_code_language';
export const DEFAULT_CODE_LANGUAGE = 'js';

export const CUSTOM_CONTAINER_TITLES: Record<CustomContainerType, string> = {
  info: '相关信息',
  note: '注',
  warning: '注意',
  danger: '警告',
  tip: '提示',
};

export const COMMON_CODE_LANGUAGES = [
  'js',
  'javascript',
  'ts',
  'typescript',
  'python',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
  'php',
  'html',
  'css',
  'sql',
  'bash',
  'shell',
  'json',
  'yaml',
] as const;

export function resolveEditorEngine(rawValue?: string | null): EditorEngine {
  return rawValue === 'bytemd' ? 'bytemd' : DEFAULT_EDITOR_ENGINE;
}

export function getEditorEngine(): EditorEngine {
  if (typeof window === 'undefined') {
    return DEFAULT_EDITOR_ENGINE;
  }

  return resolveEditorEngine(window.localStorage.getItem(EDITOR_ENGINE_STORAGE_KEY));
}

export function getLastCodeLanguage() {
  if (typeof window === 'undefined') {
    return DEFAULT_CODE_LANGUAGE;
  }

  return window.localStorage.getItem(LAST_CODE_LANGUAGE_KEY) || DEFAULT_CODE_LANGUAGE;
}

export function saveLastCodeLanguage(language: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextLanguage = (language || DEFAULT_CODE_LANGUAGE).trim().toLowerCase();
  window.localStorage.setItem(LAST_CODE_LANGUAGE_KEY, nextLanguage || DEFAULT_CODE_LANGUAGE);
}

export function buildMoreSnippet() {
  return '<!-- more -->\n';
}

export function buildCustomContainerSnippet(type: CustomContainerType) {
  const title = CUSTOM_CONTAINER_TITLES[type];
  return `:::${type}{title="${title}"}\n${title}\n:::`;
}

export function buildCodeBlockSnippet(language = getLastCodeLanguage()) {
  const safeLanguage = (language || DEFAULT_CODE_LANGUAGE).trim().toLowerCase() || DEFAULT_CODE_LANGUAGE;
  return `\`\`\`${safeLanguage}\n\n\`\`\``;
}

export function buildTableSnippet() {
  return ['| 列 1 | 列 2 |', '| --- | --- |', '| 内容 1 | 内容 2 |'].join('\n');
}

export function buildMathBlockSnippet() {
  return '$$\n\n$$';
}

export function buildTaskListSnippet() {
  return '- [ ] 待办事项';
}

export function buildLinkSnippet(label = '链接文本', href = 'https://') {
  return `[${label}](${href})`;
}

export function buildImageMarkdown(url: string, alt = '', title = '') {
  const safeTitle = title ? ` "${title}"` : '';
  return `![${alt}](${url}${safeTitle})`;
}

export function insertTextAtRange(
  value: string,
  range: TextRange,
  text: string,
  cursorOffset = text.length,
) {
  const start = Math.max(0, Math.min(range.start, range.end));
  const end = Math.max(start, Math.max(range.start, range.end));
  const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
  const cursor = start + cursorOffset;

  return {
    value: nextValue,
    selection: {
      start: cursor,
      end: cursor,
    },
  };
}
