import type { MarkdownThemeConfig } from '@/utils/markdownTheme';

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  themeConfig?: MarkdownThemeConfig;
  codeMaxLines?: number;
  /** 预览联动高亮开关，默认开启 */
  sourceHover?: boolean;
};

export type EditorEngine = 'milkdown' | 'bytemd';

export type CustomContainerType = 'info' | 'note' | 'warning' | 'danger' | 'tip';

export type TextRange = {
  start: number;
  end: number;
};
