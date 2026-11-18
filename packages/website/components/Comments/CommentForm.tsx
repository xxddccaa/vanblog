import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  COMMENT_LIMITS,
  createComment,
  describeCommentError,
  uploadCommentImage,
  type CommentTargetKey,
  type CreateCommentBody,
  type CreateCommentResult,
  type PublicComment,
  type PublicCommentConfig,
  type PublicCommentIdentity,
} from '../../api/comments';
import CommentMarkdown from '../CommentMarkdown';
import EmojiPanel from './EmojiPanel';
import HelpTip from './HelpTip';
import {
  clearCommentProfile,
  displayNick,
  insertText,
  isAcceptedImage,
  normalizeContent,
  saveCommentProfile,
  validateCommentDraft,
  wrapBlockSnippet,
  type CommentProfile,
} from './utils';

const MAX_FILES_PER_DROP = 5;

type EditorTab = 'write' | 'preview';

export interface CommentFormProps {
  target: CommentTargetKey;
  config: PublicCommentConfig;
  identity: PublicCommentIdentity;
  profile: CommentProfile;
  onProfileChange: (profile: CommentProfile) => void;
  remember: boolean;
  onRememberChange: (remember: boolean) => void;
  onPosted: (result: CreateCommentResult) => void;
  /** Set when the form replies to an existing comment. */
  parent?: PublicComment | null;
  onCancel?: () => void;
  autoFocus?: boolean;
}

const inputClass =
  'w-full rounded-md border border-gray-200 bg-transparent px-3 py-1.5 text-sm text-gray-700 outline-none transition-colors focus:border-blue-400 dark:border-dark-2 dark:text-dark dark:focus:border-blue-400';

const toolButtonClass =
  'inline-flex h-8 min-w-[32px] items-center justify-center gap-1 rounded px-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-dark-light dark:hover:bg-dark-hover dark:hover:text-blue-400';

function EmojiIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4.5 18 5-5 3 3 2.5-2.5 4.5 4.5" />
    </svg>
  );
}

export default function CommentForm(props: CommentFormProps) {
  const { config, identity, profile, parent } = props;
  const baseId = useId();
  const ids = {
    nick: `${baseId}-nick`,
    mail: `${baseId}-mail`,
    link: `${baseId}-link`,
    content: `${baseId}-content`,
    counter: `${baseId}-counter`,
    writeTab: `${baseId}-tab-write`,
    previewTab: `${baseId}-tab-preview`,
    writePanel: `${baseId}-panel-write`,
    previewPanel: `${baseId}-panel-preview`,
    emoji: `${baseId}-emoji`,
    honeypot: `${baseId}-website`,
    remember: `${baseId}-remember`,
  };

  const [content, setContent] = useState('');
  const [tab, setTab] = useState<EditorTab>('write');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const contentRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<EditorTab, HTMLButtonElement | null>>({
    write: null,
    preview: null,
  });

  const isAdmin = Boolean(identity.admin);
  const canUpload = isAdmin || Boolean(config.allowVisitorImage);
  const overLimit = content.length > config.maxLength;

  useEffect(() => {
    if (props.autoFocus) {
      textareaRef.current?.focus();
    }
  }, [props.autoFocus]);

  const updateContent = useCallback((value: string) => {
    contentRef.current = value;
    setContent(value);
  }, []);

  const insertAtCursor = useCallback(
    (text: string, block = false) => {
      const textarea = textareaRef.current;
      const current = contentRef.current;
      const start = textarea ? textarea.selectionStart : current.length;
      const end = textarea ? textarea.selectionEnd : current.length;
      const snippet = block ? wrapBlockSnippet(current, start, text) : text;
      const next = insertText(current, start, end, snippet);
      updateContent(next.value);
      if (textarea) {
        const restore = () => {
          try {
            textarea.setSelectionRange(next.cursor, next.cursor);
          } catch {
            // Detached or hidden textareas may refuse selection updates.
          }
        };
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(restore);
        } else {
          restore();
        }
      }
    },
    [updateContent],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!canUpload || !files.length) {
        return;
      }
      setError('');
      for (const file of files.slice(0, MAX_FILES_PER_DROP)) {
        if (!isAcceptedImage(file)) {
          setError('仅支持 PNG、JPEG、WebP、GIF 格式的图片');
          continue;
        }
        if (file.size > COMMENT_LIMITS.imageMaxBytes) {
          setError('图片不能超过 5 MB');
          continue;
        }
        setUploading((count) => count + 1);
        try {
          const result = await uploadCommentImage(file, props.target);
          insertAtCursor(result.markdown, true);
        } catch (uploadError) {
          setError(describeCommentError(uploadError));
        } finally {
          setUploading((count) => Math.max(0, count - 1));
        }
      }
    },
    [canUpload, insertAtCursor, props.target],
  );

  const onPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canUpload) {
      return;
    }
    const files = Array.from(event.clipboardData?.files || []).filter((file) =>
      String(file.type).startsWith('image/'),
    );
    if (!files.length) {
      return;
    }
    event.preventDefault();
    void uploadFiles(files);
  };

  const hasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes('Files');

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canUpload || !hasFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setDragActive(true);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setDragActive(false);
    if (!canUpload || !hasFiles(event)) {
      return;
    }
    event.preventDefault();
    void uploadFiles(Array.from(event.dataTransfer?.files || []));
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const next: EditorTab =
      event.key === 'Home'
        ? 'write'
        : event.key === 'End'
          ? 'preview'
          : tab === 'write'
            ? 'preview'
            : 'write';
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const setProfileField = (field: keyof CommentProfile, value: string) => {
    props.onProfileChange({ ...profile, [field]: value });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const problem = validateCommentDraft({ ...profile, content }, config, isAdmin);
    if (problem) {
      setError(problem);
      return;
    }
    if (uploading > 0) {
      setError('请等待图片上传完成');
      return;
    }
    const body: CreateCommentBody = {
      target: props.target,
      parentId: parent ? parent.id : null,
      content: normalizeContent(content),
      website: honeypot,
    };
    const trimmedProfile = {
      nick: profile.nick.trim(),
      mail: profile.mail.trim(),
      link: profile.link.trim(),
    };
    if (!isAdmin) {
      body.nick = trimmedProfile.nick;
      body.mail = trimmedProfile.mail;
      body.link = trimmedProfile.link;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await createComment(body);
      if (!isAdmin) {
        if (props.remember) {
          saveCommentProfile(trimmedProfile);
        } else {
          clearCommentProfile();
        }
      }
      updateContent('');
      setTab('write');
      setEmojiOpen(false);
      props.onPosted(result);
    } catch (submitError) {
      setError(describeCommentError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || uploading > 0;
  const submitLabel = submitting ? '提交中…' : parent ? '回复' : '发表评论';

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={parent ? `回复 ${displayNick(parent.nick)}` : '发表评论'}
      className={parent ? 'mt-3' : ''}
    >
      {parent && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-dark-light">
          <span className="min-w-0 truncate">回复 @{displayNick(parent.nick)}</span>
          <button
            type="button"
            onClick={props.onCancel}
            className="flex-shrink-0 rounded px-1.5 py-0.5 hover:text-blue-600 dark:hover:text-blue-400"
          >
            取消回复
          </button>
        </div>
      )}

      {isAdmin ? (
        <p className="mb-2 text-sm text-gray-600 dark:text-dark-light">
          以博主身份发言{identity.nick ? `：${identity.nick}` : ''}
        </p>
      ) : (
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="min-w-0">
            <label
              htmlFor={ids.nick}
              className="mb-1 block text-xs text-gray-500 dark:text-dark-light"
            >
              昵称
            </label>
            <input
              id={ids.nick}
              name="nick"
              type="text"
              autoComplete="nickname"
              maxLength={COMMENT_LIMITS.nickMaxLength}
              placeholder="留空则显示为匿名"
              value={profile.nick}
              onChange={(event) => setProfileField('nick', event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="relative min-w-0">
            <div className="mb-1 flex items-center text-xs text-gray-500 dark:text-dark-light">
              <label htmlFor={ids.mail}>
                邮箱（不公开）
                {config.requireMail && (
                  <span className="ml-0.5 text-red-500" aria-hidden="true">
                    *
                  </span>
                )}
              </label>
              <HelpTip label="邮箱">
                只在有人回复你的评论时，用来给你发邮件提醒。邮箱不会显示在页面上，也不会公开给其他访客。
              </HelpTip>
            </div>
            <input
              id={ids.mail}
              name="mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={COMMENT_LIMITS.mailMaxLength}
              required={config.requireMail}
              aria-required={config.requireMail}
              placeholder={config.requireMail ? '必填' : '选填'}
              value={profile.mail}
              onChange={(event) => setProfileField('mail', event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="relative min-w-0">
            <div className="mb-1 flex items-center text-xs text-gray-500 dark:text-dark-light">
              <label htmlFor={ids.link}>个人网站</label>
              <HelpTip label="个人网站">
                选填。填写你自己的博客或主页地址后，你的昵称会变成指向它的链接，方便其他人访问。
              </HelpTip>
            </div>
            <input
              id={ids.link}
              name="link"
              type="url"
              autoComplete="url"
              inputMode="url"
              maxLength={COMMENT_LIMITS.linkMaxLength}
              placeholder="选填，如 https://example.com"
              value={profile.link}
              onChange={(event) => setProfileField('link', event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div
        onDragOver={onDragOver}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`rounded-md border transition-colors ${
          dragActive ? 'border-blue-400' : 'border-gray-200 dark:border-dark-2'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1 border-b border-gray-200 px-1 dark:border-dark-2">
          <div role="tablist" aria-label="评论编辑模式" className="flex">
            {(['write', 'preview'] as const).map((value) => (
              <button
                key={value}
                ref={(element) => {
                  tabRefs.current[value] = element;
                }}
                id={value === 'write' ? ids.writeTab : ids.previewTab}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls={value === 'write' ? ids.writePanel : ids.previewPanel}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => setTab(value)}
                onKeyDown={onTabKeyDown}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === value
                    ? 'border-blue-500 text-gray-800 dark:text-dark-hover'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-dark-light dark:hover:text-dark'
                }`}
              >
                {value === 'write' ? '编辑' : '预览'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              ref={emojiButtonRef}
              type="button"
              aria-label="插入表情"
              title="插入表情"
              aria-expanded={emojiOpen}
              aria-controls={ids.emoji}
              onClick={() => setEmojiOpen((open) => !open)}
              className={toolButtonClass}
            >
              <EmojiIcon />
            </button>
            {canUpload && (
              <>
                <button
                  type="button"
                  aria-label="上传图片"
                  title="上传图片（也可粘贴或拖拽）"
                  disabled={uploading > 0}
                  onClick={() => fileInputRef.current?.click()}
                  className={toolButtonClass}
                >
                  <ImageIcon />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = '';
                    void uploadFiles(files);
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div
          id={ids.writePanel}
          role="tabpanel"
          aria-labelledby={ids.writeTab}
          hidden={tab !== 'write'}
        >
          <label htmlFor={ids.content} className="sr-only">
            评论内容
          </label>
          <textarea
            ref={textareaRef}
            id={ids.content}
            name="content"
            rows={parent ? 3 : 4}
            value={content}
            onChange={(event) => updateContent(event.target.value)}
            onPaste={onPaste}
            aria-describedby={ids.counter}
            aria-invalid={overLimit || undefined}
            placeholder={
              canUpload
                ? '写下你的评论，支持 Markdown，可粘贴或拖拽图片'
                : '写下你的评论，支持 Markdown'
            }
            className="block min-h-[96px] w-full resize-y bg-transparent px-3 py-2 text-sm leading-6 text-gray-700 outline-none dark:text-dark"
          />
        </div>
        <div
          id={ids.previewPanel}
          role="tabpanel"
          aria-labelledby={ids.previewTab}
          hidden={tab !== 'preview'}
          className="min-h-[96px] px-3 py-2"
        >
          {tab === 'preview' &&
            (content.trim() ? (
              <CommentMarkdown content={content} />
            ) : (
              <p className="text-sm text-gray-400 dark:text-dark-400">没有可预览的内容</p>
            ))}
        </div>
      </div>

      {emojiOpen && (
        <EmojiPanel
          id={ids.emoji}
          onSelect={(emoji) => insertAtCursor(emoji)}
          onClose={() => {
            setEmojiOpen(false);
            emojiButtonRef.current?.focus();
          }}
        />
      )}

      <div className="vb-comment-hp" aria-hidden="true">
        <label htmlFor={ids.honeypot}>网站</label>
        <input
          id={ids.honeypot}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-dark-light">
          <span id={ids.counter} className={overLimit ? 'text-red-500' : ''}>
            {content.length} / {config.maxLength}
          </span>
          {!isAdmin && (
            <label htmlFor={ids.remember} className="inline-flex cursor-pointer items-center gap-1">
              <input
                id={ids.remember}
                type="checkbox"
                checked={props.remember}
                onChange={(event) => props.onRememberChange(event.target.checked)}
              />
              记住我的信息
            </label>
          )}
          {uploading > 0 && <span role="status">图片上传中…</span>}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {submitLabel}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}
    </form>
  );
}
