import ResponsivePageTabs, { toPageContainerTabList } from '@/components/ResponsivePageTabs';
import {
  batchUpdateComments,
  deleteComment,
  getArticlesByOption,
  getComments,
  getCommentSetting,
  getCommentStats,
  purgeComment,
  updateComment,
} from '@/services/van-blog/api';
import { checkDemo } from '@/services/van-blog/check';
import {
  buildCommentListParams,
  COMMENT_LIMITS,
  COMMENT_STATUS_FILTERS,
  COMMENT_STATUS_TABS,
  describeBatchFailures,
  formatCommentError,
  getActionTargetStatus,
  getCommentNick,
  getCommentPublicHref,
  getCommentRowActions,
  getCommentStatusCount,
  getCommentStatusMeta,
  getSafeExternalLink,
  normalizeCommentStatusFilter,
  unwrapCommentResponse,
} from '@/services/van-blog/comment';
import { publishCommentStats } from '@/services/van-blog/commentPending';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { DownOutlined, SettingOutlined } from '@ant-design/icons';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Badge, Button, Dropdown, message, Modal, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CommentContentModal from './CommentContentModal';
import CommentDetail, { formatCommentTime } from './CommentDetail';

const { Text, Paragraph } = Typography;

const ACTION_LABELS = {
  approve: '通过',
  spam: '标为垃圾',
  pending: '移回待审',
  pin: '置顶',
  unpin: '取消置顶',
  edit: '编辑',
  reply: '回复',
  delete: '删除',
  restore: '恢复',
  purge: '彻底删除',
};

const ACTION_SUCCESS = {
  approve: '已通过',
  spam: '已标为垃圾评论',
  pending: '已移回待审核',
  pin: '已置顶',
  unpin: '已取消置顶',
  delete: '已删除，可在“已删除”中恢复',
  restore: '已恢复到待审核',
  purge: '已彻底删除',
};

const INLINE_ACTIONS = ['approve', 'restore', 'reply'];
const DANGER_ACTIONS = ['delete', 'purge'];

const BATCH_ACTIONS = [
  { action: 'approve', label: '批量通过' },
  { action: 'spam', label: '批量标为垃圾' },
  { action: 'delete', label: '批量删除' },
  { action: 'purge', label: '批量彻底删除', danger: true },
];

const PAGE_TARGET_OPTIONS = [
  { label: '关于页', value: 'page:about' },
  { label: '友链页', value: 'page:link' },
];

const loadTargetOptions = async ({ keyWords } = {}) => {
  try {
    const option = { page: 1, pageSize: 20 };
    const keyword = typeof keyWords === 'string' ? keyWords.trim() : '';
    if (keyword) option.title = keyword;
    const response = await getArticlesByOption(option);
    const articles = Array.isArray(response?.data?.articles) ? response.data.articles : [];
    return [
      ...PAGE_TARGET_OPTIONS,
      ...articles.map((article) => ({
        label: `${article.title || '无标题'}（#${article.id}）`,
        value: `post:${article.id}`,
      })),
    ];
  } catch {
    return PAGE_TARGET_OPTIONS;
  }
};

const renderTabLabel = (item, stats) => {
  const count = getCommentStatusCount(stats, item.key);
  if (item.key === 'pending' && count) {
    return (
      <Space size={6}>
        <span>{item.label}</span>
        <Badge count={count} overflowCount={999} size="small" />
      </Space>
    );
  }
  return count === undefined ? item.label : `${item.label} (${count})`;
};

export default function CommentManage() {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef();
  const [rawStatus, setStatus] = useTab('all', 'status', COMMENT_STATUS_FILTERS);
  const status = normalizeCommentStatusFilter(rawStatus);
  const [stats, setStats] = useState(null);
  const [maxLength, setMaxLength] = useState(COMMENT_LIMITS.contentDefaultMaxLength);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editing, setEditing] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const data = unwrapCommentResponse(await getCommentStats());
      setStats(data);
      publishCommentStats(data);
    } catch {
      // Tab counts are optional; the list request reports real failures.
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    getCommentSetting()
      .then((response) => {
        const data = unwrapCommentResponse(response);
        if (!disposed && Number(data?.maxLength) > 0) setMaxLength(Number(data.maxLength));
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [status]);

  const reload = useCallback(() => {
    actionRef.current?.reload();
  }, []);

  const runAction = useCallback(
    async (record, action) => {
      if (action === 'edit' || action === 'reply') {
        setEditing({ mode: action, record });
        return;
      }
      if (!checkDemo()) return;
      const execute = async () => {
        try {
          let response;
          if (action === 'pin' || action === 'unpin') {
            response = await updateComment(record.id, { pinned: action === 'pin' });
          } else if (action === 'delete') {
            response = await deleteComment(record.id);
          } else if (action === 'purge') {
            response = await purgeComment(record.id);
          } else {
            response = await updateComment(record.id, { status: getActionTargetStatus(action) });
          }
          const data = unwrapCommentResponse(response);
          if (action === 'purge' && Number(data?.purged) > 1) {
            message.success(`已彻底删除 ${data.purged} 条评论（含回复）`);
          } else {
            message.success(ACTION_SUCCESS[action] || '操作成功');
          }
          reload();
        } catch (error) {
          message.error(formatCommentError(error, `${ACTION_LABELS[action]}失败`));
        }
      };
      if (action === 'purge') {
        Modal.confirm({
          title: '彻底删除这条评论？',
          content: '彻底删除后无法恢复，这条评论下的所有回复也会一并删除。',
          okText: '彻底删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: execute,
        });
        return;
      }
      await execute();
    },
    [reload],
  );

  const runBatch = useCallback(
    (action) => {
      if (!checkDemo()) return;
      const ids = selectedRowKeys.map(Number).filter((id) => Number.isInteger(id));
      if (!ids.length) return;
      if (ids.length > COMMENT_LIMITS.batchMaxIds) {
        message.warning(`一次最多处理 ${COMMENT_LIMITS.batchMaxIds} 条评论`);
        return;
      }
      const execute = async () => {
        try {
          const result = unwrapCommentResponse(await batchUpdateComments(ids, action));
          const failures = describeBatchFailures(result);
          const updated = Number(result?.updated) || 0;
          if (failures.length) {
            Modal.warning({
              title: `已处理 ${updated} 条，${failures.length} 条失败`,
              content: (
                <ul style={{ paddingLeft: 20, marginBottom: 0, maxHeight: 320, overflow: 'auto' }}>
                  {failures.map((item) => (
                    <li key={item.id}>{`#${item.id}：${item.reason}`}</li>
                  ))}
                </ul>
              ),
            });
          } else {
            message.success(`已处理 ${updated} 条评论`);
          }
          setSelectedRowKeys([]);
          reload();
        } catch (error) {
          message.error(formatCommentError(error, '批量操作失败'));
        }
      };
      if (action === 'purge') {
        Modal.confirm({
          title: `彻底删除选中的 ${ids.length} 条评论？`,
          content: '彻底删除后无法恢复，这些评论下的所有回复也会一并删除。',
          okText: '彻底删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: execute,
        });
        return;
      }
      execute();
    },
    [reload, selectedRowKeys],
  );

  const renderActions = useCallback(
    (record) => {
      const actions = getCommentRowActions(record);
      const inline =
        record.status === 'deleted' ? actions : actions.filter((a) => INLINE_ACTIONS.includes(a));
      const more = actions.filter((a) => !inline.includes(a));
      return (
        <Space size={[8, 4]} wrap>
          {inline.map((action) => (
            <a
              key={action}
              onClick={() => runAction(record, action)}
              style={DANGER_ACTIONS.includes(action) ? { color: '#ff4d4f' } : undefined}
            >
              {ACTION_LABELS[action]}
            </a>
          ))}
          {more.length ? (
            <Dropdown
              trigger={['click']}
              menu={{
                items: more.map((action) => ({
                  key: action,
                  label: ACTION_LABELS[action],
                  danger: DANGER_ACTIONS.includes(action),
                })),
                onClick: ({ key }) => runAction(record, key),
              }}
            >
              <a>
                更多 <DownOutlined style={{ fontSize: 10 }} />
              </a>
            </Dropdown>
          ) : null}
        </Space>
      );
    },
    [runAction],
  );

  const columns = useMemo(
    () => [
      {
        title: '关键词',
        dataIndex: 'search',
        hideInTable: true,
        fieldProps: { placeholder: '内容、昵称、邮箱或 IP', maxLength: 100 },
      },
      {
        title: '所在页面',
        dataIndex: 'target',
        hideInTable: true,
        valueType: 'select',
        request: loadTargetOptions,
        debounceTime: 300,
        fieldProps: { showSearch: true, filterOption: false, placeholder: '搜索文章标题' },
      },
      {
        title: '作者',
        dataIndex: 'nick',
        search: false,
        width: 200,
        render: (_, record) => {
          const link = getSafeExternalLink(record.link);
          return (
            <Space direction="vertical" size={0} style={{ maxWidth: 190 }}>
              <Space size={4} wrap>
                <Text strong>{getCommentNick(record)}</Text>
                {record.isAdmin ? <Tag color="blue">博主</Tag> : null}
              </Space>
              {record.mail ? (
                <Text
                  type="secondary"
                  ellipsis={{ tooltip: record.mail }}
                  style={{ maxWidth: 190 }}
                >
                  {record.mail}
                </Text>
              ) : null}
              {link ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={link}
                  style={{
                    display: 'inline-block',
                    maxWidth: 190,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link}
                </a>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: '内容',
        dataIndex: 'content',
        search: false,
        width: 320,
        render: (_, record) => (
          <div>
            {record.replyToNick ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {`回复 @${record.replyToNick}`}
              </Text>
            ) : null}
            <Paragraph
              ellipsis={{ rows: 3 }}
              style={{ marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {record.content || '（空）'}
            </Paragraph>
          </div>
        ),
      },
      {
        title: '所在页面',
        dataIndex: 'targetTitle',
        search: false,
        width: 180,
        render: (_, record) => {
          const href = getCommentPublicHref(record);
          const title = record.targetTitle || record.target || '-';
          return (
            <Space direction="vertical" size={2} style={{ maxWidth: 170 }}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {title}
                </a>
              ) : (
                <Text type="secondary">{title}</Text>
              )}
              {record.targetAvailable ? null : <Tag>已不可用</Tag>}
            </Space>
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        search: false,
        width: 90,
        render: (_, record) => {
          const meta = getCommentStatusMeta(record.status);
          return <Tag color={meta.color}>{meta.text}</Tag>;
        },
      },
      {
        title: '置顶',
        dataIndex: 'pinned',
        search: false,
        width: 70,
        render: (_, record) => (record.pinned ? <Tag color="gold">置顶</Tag> : '-'),
      },
      {
        title: '点赞',
        dataIndex: 'likes',
        search: false,
        width: 70,
        render: (_, record) => Number(record.likes) || 0,
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        search: false,
        width: 150,
        render: (_, record) => (
          <span title={formatCommentTime(record.createdAt)}>
            {formatCommentTime(record.createdAt, 'YYYY-MM-DD HH:mm')}
          </span>
        ),
      },
      {
        title: '操作',
        valueType: 'option',
        key: 'option',
        width: 170,
        fixed: 'right',
        render: (_, record) => renderActions(record),
      },
    ],
    [renderActions],
  );

  const tabs = COMMENT_STATUS_TABS.map((item) => ({
    key: item.key,
    label: renderTabLabel(item, stats),
  }));

  return (
    <PageContainer
      title={mobile ? false : '评论管理'}
      tabActiveKey={status}
      tabList={mobile ? undefined : toPageContainerTabList(tabs)}
      onTabChange={setStatus}
      extra={
        mobile ? null : (
          <Button
            icon={<SettingOutlined />}
            onClick={() => history.push('/site/setting?tab=comment')}
          >
            评论设置
          </Button>
        )
      }
    >
      {mobile ? <ResponsivePageTabs items={tabs} activeKey={status} onChange={setStatus} /> : null}
      <ProTable
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        params={{ status }}
        cardBordered
        headerTitle="评论列表"
        scroll={{ x: 1360 }}
        search={{ labelWidth: 'auto' }}
        options={{ reload: true, density: true, setting: true }}
        pagination={{
          defaultPageSize: COMMENT_LIMITS.adminPageSizeDefault,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        rowSelection={{
          selectedRowKeys,
          preserveSelectedRowKeys: true,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        tableAlertOptionRender={({ selectedRowKeys: keys, onCleanSelected }) => (
          <Space size={12} wrap>
            {BATCH_ACTIONS.filter((item) => status !== 'deleted' || item.action === 'purge').map(
              (item) => (
                <a
                  key={item.action}
                  onClick={() => runBatch(item.action)}
                  style={item.danger ? { color: '#ff4d4f' } : undefined}
                >
                  {item.label}
                </a>
              ),
            )}
            <a onClick={onCleanSelected}>{`取消选择（${keys.length}）`}</a>
          </Space>
        )}
        expandable={{
          expandedRowRender: (record) => <CommentDetail record={record} />,
        }}
        toolBarRender={() =>
          mobile
            ? [
                <Button
                  key="setting"
                  icon={<SettingOutlined />}
                  onClick={() => history.push('/site/setting?tab=comment')}
                >
                  设置
                </Button>,
              ]
            : []
        }
        request={async (params = {}) => {
          loadStats();
          try {
            const query = buildCommentListParams({
              current: params.current,
              pageSize: params.pageSize,
              status: params.status,
              search: params.search,
              target: params.target,
            });
            const data = unwrapCommentResponse(await getComments(query));
            return {
              data: Array.isArray(data?.items) ? data.items : [],
              total: Number(data?.total) || 0,
              success: true,
            };
          } catch (error) {
            message.error(formatCommentError(error, '加载评论失败'));
            return { data: [], total: 0, success: false };
          }
        }}
      />
      <CommentContentModal
        mode={editing?.mode}
        record={editing?.record}
        maxLength={maxLength}
        onCancel={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          reload();
        }}
      />
    </PageContainer>
  );
}
