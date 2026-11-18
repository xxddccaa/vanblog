'use client';

import '../../styles/markdown-content.css';
import '../../styles/comments.css';
import React from 'react';
import { Viewer } from '@bytemd/react';
import { COMMENT_REMARK_REHYPE, commentMarkdownPlugins, sanitizeCommentSchema } from './schema';

// Stable references: the bytemd Viewer re-processes whenever one changes.
const remarkRehype = { ...COMMENT_REMARK_REHYPE };

export default function CommentMarkdown({ content }: { content: string }) {
  return (
    <div className="vb-comment-markdown">
      <Viewer
        value={content}
        plugins={commentMarkdownPlugins}
        remarkRehype={remarkRehype}
        sanitize={sanitizeCommentSchema}
      />
    </div>
  );
}
