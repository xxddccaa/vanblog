import { replyComment, updateComment } from '@/services/van-blog/api';
import { checkDemo } from '@/services/van-blog/check';
import {
  COMMENT_LIMITS,
  formatCommentError,
  getCommentNick,
  unwrapCommentResponse,
} from '@/services/van-blog/comment';
import { Alert, Checkbox, Input, Modal, Spin, Tabs, Typography, message } from 'antd';
import { lazy, Suspense, useEffect, useState } from 'react';

const CommentMarkdownPreview = lazy(() => import('@/components/CommentMarkdownPreview'));

const quoteStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 160,
  overflow: 'auto',
  padding: '8px 12px',
  marginBottom: 12,
  borderRadius: 6,
  background: 'rgba(127, 127, 127, 0.08)',
};

/**
 * Edit a comment or reply to it as the blog owner.
 * `mode` is 'edit' or 'reply'; `record` is the AdminComment being handled.
 */
export default function CommentContentModal({ mode, record, maxLength, onCancel, onDone }) {
  const open = Boolean(record && mode);
  const isReply = mode === 'reply';
  const settingLimit = Math.min(
    Number(maxLength) || COMMENT_LIMITS.contentDefaultMaxLength,
    COMMENT_LIMITS.contentHardMaxLength,
  );
  // An edit must not truncate a comment accepted under an older, larger limit.
  const limit =
    !isReply && record?.content
      ? Math.min(Math.max(settingLimit, record.content.length), COMMENT_LIMITS.contentHardMaxLength)
      : settingLimit;
  const [value, setValue] = useState('');
  const [tab, setTab] = useState('write');
  const [approveParent, setApproveParent] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(isReply ? '' : record.content || '');
    setTab('write');
    setApproveParent(true);
  }, [open, isReply, record]);

  const handleOk = async () => {
    if (!checkDemo()) return;
    const content = value.trim();
    if (!content) {
      message.warning(isReply ? '回复内容不能为空' : '评论内容不能为空');
      return;
    }
    if (content.length > limit) {
      message.warning(`内容不能超过 ${limit} 个字符`);
      return;
    }
    setSubmitting(true);
    try {
      if (isReply) {
        if (record.status === 'pending' && approveParent) {
          unwrapCommentResponse(await updateComment(record.id, { status: 'approved' }));
        }
        unwrapCommentResponse(await replyComment(record.id, content));
        message.success('回复成功');
      } else {
        unwrapCommentResponse(await updateComment(record.id, { content }));
        message.success('评论已更新');
      }
      onDone?.();
    } catch (error) {
      message.error(formatCommentError(error, isReply ? '回复失败' : '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isReply ? `回复 ${record ? getCommentNick(record) : ''}` : '编辑评论'}
      okText={isReply ? '发表回复' : '保存'}
      cancelText="取消"
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={() => {
        if (!submitting) onCancel?.();
      }}
      width={720}
      destroyOnClose
      maskClosable={false}
    >
      {isReply && record ? (
        <>
          <div style={quoteStyle}>{record.content}</div>
          {record.status === 'pending' ? (
            <Checkbox
              checked={approveParent}
              onChange={(event) => setApproveParent(event.target.checked)}
              style={{ marginBottom: 12 }}
            >
              同时通过这条评论（待审核评论下的回复在其通过前不会公开显示）
            </Checkbox>
          ) : null}
        </>
      ) : null}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        size="small"
        items={[
          {
            key: 'write',
            label: '编辑',
            children: (
              <Input.TextArea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                showCount
                maxLength={limit}
                autoSize={{ minRows: 6, maxRows: 16 }}
                placeholder={isReply ? '以博主身份回复，支持 Markdown' : '支持 Markdown'}
                autoFocus
              />
            ),
          },
          {
            key: 'preview',
            label: '预览',
            children: value.trim() ? (
              <div style={{ maxHeight: 420, overflow: 'auto' }}>
                <Suspense fallback={<Spin />}>
                  <CommentMarkdownPreview value={value} />
                </Suspense>
              </div>
            ) : (
              <Typography.Text type="secondary">暂无内容</Typography.Text>
            ),
          },
        ]}
      />
      {isReply ? null : (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="修改后访客看到的是新内容，原文不会保留。"
        />
      )}
    </Modal>
  );
}
