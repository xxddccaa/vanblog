import { Viewer } from '@bytemd/react';
import { useModel } from '@umijs/max';
import { useMemo } from 'react';
import '../../style/github-markdown.css';
import {
  COMMENT_REMARK_REHYPE_OPTIONS,
  getCommentPreviewPlugins,
  sanitizeCommentSchema,
} from './sanitize';

export default function CommentMarkdownPreview(props: { value: string }) {
  const { initialState } = useModel('@@initialState');
  const navTheme = String(initialState?.settings?.navTheme || '');
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';
  const plugins = useMemo(() => getCommentPreviewPlugins(), []);

  return (
    <div className={themeClass} data-testid="comment-markdown-preview">
      <Viewer
        value={props.value || ''}
        plugins={plugins}
        sanitize={sanitizeCommentSchema}
        remarkRehype={COMMENT_REMARK_REHYPE_OPTIONS}
      />
    </div>
  );
}
