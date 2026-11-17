import {
  getCommentNick,
  getCommentPublicHref,
  getCommentStatusMeta,
  getSafeExternalLink,
} from '@/services/van-blog/comment';
import { Descriptions, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

export const formatCommentTime = (value, pattern = 'YYYY-MM-DD HH:mm:ss') => {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(pattern) : String(value);
};

const plainBlockStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  maxHeight: 320,
  overflow: 'auto',
};

const orDash = (value) => (value ? <Text>{value}</Text> : <Text type="secondary">-</Text>);

/** Expanded row: every field is rendered as plain text. */
export default function CommentDetail({ record }) {
  const link = getSafeExternalLink(record.link);
  const targetHref = getCommentPublicHref(record);
  const status = getCommentStatusMeta(record.status);

  return (
    <Descriptions
      size="small"
      bordered
      column={{ xs: 1, sm: 1, md: 2 }}
      data-testid="comment-detail"
    >
      <Descriptions.Item label="完整内容" span="filled">
        <div style={plainBlockStyle}>{record.content || <Text type="secondary">（空）</Text>}</div>
      </Descriptions.Item>
      <Descriptions.Item label="回复对象" span="filled">
        {record.parentId ? (
          <div style={plainBlockStyle}>
            <Text type="secondary">{`@${record.replyToNick || '匿名'}（#${
              record.parentId
            }）：`}</Text>
            {record.parentExcerpt || <Text type="secondary">（无摘要）</Text>}
          </div>
        ) : (
          <Text type="secondary">顶层评论</Text>
        )}
      </Descriptions.Item>
      <Descriptions.Item label="所在页面">
        {targetHref ? (
          <a href={targetHref} target="_blank" rel="noopener noreferrer">
            {record.targetTitle || record.target}
          </a>
        ) : (
          <Text type="secondary">{record.targetTitle || record.target || '-'}</Text>
        )}
        {record.targetAvailable ? null : <Tag style={{ marginLeft: 8 }}>已不可用</Tag>}
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.target}
          </Text>
        </div>
      </Descriptions.Item>
      <Descriptions.Item label="状态">
        <Tag color={status.color}>{status.text}</Tag>
        {record.pinned ? <Tag color="gold">置顶</Tag> : null}
        {record.isAdmin ? <Tag color="blue">博主</Tag> : null}
      </Descriptions.Item>
      <Descriptions.Item label="昵称">{getCommentNick(record)}</Descriptions.Item>
      <Descriptions.Item label="邮箱">
        {record.mail ? <Text copyable={{ text: record.mail }}>{record.mail}</Text> : orDash('')}
      </Descriptions.Item>
      <Descriptions.Item label="网址" span="filled">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer nofollow">
            {link}
          </a>
        ) : record.link ? (
          <Text type="secondary">{`${record.link}（不是有效的 http/https 地址）`}</Text>
        ) : (
          orDash('')
        )}
      </Descriptions.Item>
      <Descriptions.Item label="IP">
        {record.ip ? (
          <Text code copyable={{ text: record.ip }} style={{ overflowWrap: 'anywhere' }}>
            {record.ip}
          </Text>
        ) : (
          orDash('')
        )}
      </Descriptions.Item>
      <Descriptions.Item label="归属地">{orDash(record.location)}</Descriptions.Item>
      <Descriptions.Item label="浏览器">{orDash(record.browser)}</Descriptions.Item>
      <Descriptions.Item label="操作系统">{orDash(record.os)}</Descriptions.Item>
      <Descriptions.Item label="User-Agent" span="filled">
        {record.ua ? (
          <Text type="secondary" style={{ wordBreak: 'break-all' }}>
            {record.ua}
          </Text>
        ) : (
          orDash('')
        )}
      </Descriptions.Item>
      <Descriptions.Item label="评论 ID">
        {`#${record.id}${record.rootId ? `（楼层 #${record.rootId}）` : ''}`}
      </Descriptions.Item>
      <Descriptions.Item label="点赞">{Number(record.likes) || 0}</Descriptions.Item>
      <Descriptions.Item label="发表时间">{formatCommentTime(record.createdAt)}</Descriptions.Item>
      <Descriptions.Item label="更新时间">{formatCommentTime(record.updatedAt)}</Descriptions.Item>
    </Descriptions>
  );
}
