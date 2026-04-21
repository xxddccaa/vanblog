import DocumentViewer from '@/components/DocumentViewer';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Empty, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, renderScore, sourceTypeLabelMap } from './shared';
import styles from './index.less';

const { Paragraph, Text } = Typography;

const suggestions = [
  '请概括一下我博客里关于无人机巡检的内容',
  '总结我博客里和相机模型相关的研究记录',
  '我博客里写过哪些关于网络爬虫和信息提取的内容',
  '整理一下我博客里涉及 MPC 与机器学习结合的文章线索',
];

const formatSourceScope = (counts = {}) =>
  `文章 ${counts.article ?? 0} / 草稿 ${counts.draft ?? 0} / 文档 ${counts.document ?? 0}`;

const getConversationAuthor = (conversation) =>
  conversation?.createdByNickname || conversation?.createdByName || '管理员';

const getMessageAuthor = (message) =>
  message?.createdByNickname || message?.createdByName || '你';

export default function ChatTab(props) {
  const {
    mobile,
    status,
    activeConversation,
    conversationList,
    conversationTotal,
    conversationLoading,
    conversationLoadingMore,
    conversationDetailLoading,
    messages,
    question,
    chatting,
    onQuestionChange,
    onAsk,
    onResetChat,
    onOpenConversation,
    onLoadMoreConversations,
    onStartRenameConversation,
    onDeleteConversation,
  } = props;

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const chatSurfaceRef = useRef(null);

  const sourceScope = formatSourceScope(status?.sourceCounts);
  const latestSyncTime = formatTime(status?.lastFullSyncAt || status?.lastSyncAt);
  const canLoadMore = conversationList.length < conversationTotal;

  useEffect(() => {
    const container = chatSurfaceRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, activeConversation?.id, chatting]);

  const currentConversationMeta = useMemo(() => {
    if (!activeConversation) {
      return {
        title: '新的共享会话',
        subtitle: '首轮回复成功后自动落库，其他管理员也可以继续追问这条会话。',
      };
    }
    return {
      title: activeConversation.title || '未命名会话',
      subtitle: `由 ${getConversationAuthor(activeConversation)} 创建 · ${
        activeConversation.messageCount ?? 0
      } 条消息 · 最近更新 ${formatTime(activeConversation.updatedAt)}`,
    };
  }, [activeConversation]);

  const workspaceMetrics = useMemo(
    () => [
      {
        key: 'scope',
        label: '知识范围',
        value: '文章 / 草稿 / 文档',
        text: sourceScope,
      },
      {
        key: 'sync',
        label: '同步状态',
        value: `${status?.syncedSources ?? 0} / ${status?.totalSources ?? 0}`,
        text: latestSyncTime === '未记录' ? '等待下一次同步' : `最近同步 ${latestSyncTime}`,
      },
      {
        key: 'history',
        label: '共享历史',
        value: `${conversationTotal}`,
        text: conversationTotal > 0 ? '支持继续追问、重命名、删除' : '还没有共享会话',
      },
    ],
    [conversationTotal, latestSyncTime, sourceScope, status?.syncedSources, status?.totalSources],
  );

  const renderConversationList = () => (
    <div className={styles.historyRailBody}>
      <div className={styles.historyRailSticky}>
        <div className={styles.historyRailEyebrow}>共享会话</div>
        <div className={styles.historyRailHead}>
          <div className={styles.historyRailTitle}>历史会话</div>
          <div className={styles.historyRailCount}>{conversationTotal}</div>
        </div>
        <div className={styles.historyRailHint}>
          管理员发起的问答会自动写入数据库，可随时打开历史继续聊。
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          block
          className={styles.historyNewButton}
          onClick={() => {
            onResetChat();
            setHistoryDrawerOpen(false);
          }}
          disabled={chatting}
        >
          新会话
        </Button>
      </div>

      <div className={styles.historyRailList}>
        {conversationLoading ? (
          <div className={styles.historyLoadingWrap}>
            <Spin />
          </div>
        ) : conversationList.length === 0 ? (
          <div className={styles.historyEmptyWrap}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有共享会话历史" />
          </div>
        ) : (
          <>
            {conversationList.map((item) => {
              const active = activeConversation?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.historyItem} ${active ? styles.historyItemActive : ''}`}
                  onClick={() => {
                    onOpenConversation(item.id);
                    setHistoryDrawerOpen(false);
                  }}
                  disabled={chatting}
                >
                  <div className={styles.historyItemTop}>
                    <div className={styles.historyItemTitle}>{item.title || '未命名会话'}</div>
                    <div className={styles.historyItemCount}>{item.messageCount ?? 0} 条</div>
                  </div>
                  <div className={styles.historyItemPreview}>
                    {item.lastMessagePreview || '这条会话还没有摘要'}
                  </div>
                  <div className={styles.historyItemMeta}>
                    <span>{getConversationAuthor(item)}</span>
                    <span>{formatTime(item.updatedAt)}</span>
                  </div>
                </button>
              );
            })}
            {canLoadMore ? (
              <Button
                block
                className={styles.historyLoadMore}
                onClick={onLoadMoreConversations}
                loading={conversationLoadingMore}
              >
                加载更多历史
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.chatWorkbench}>
      <div className={styles.chatStatusStrip}>
        <div className={styles.chatStatusLead}>
          <div className={styles.sectionEyebrow}>会话工作区</div>
          <div className={styles.chatStatusTitle}>围绕博客知识发问、继续追问、回看证据</div>
          <div className={styles.chatStatusText}>
            AI 回答会优先参考已同步到 FastGPT 的博客内容；没有直接覆盖时，也会结合通用知识补充说明。
          </div>
        </div>
        <div className={styles.chatStatusMetrics}>
          {workspaceMetrics.map((item) => (
            <div key={item.key} className={styles.chatStatusMetric}>
              <div className={styles.chatStatusMetricLabel}>{item.label}</div>
              <div className={styles.chatStatusMetricValue}>{item.value}</div>
              <div className={styles.chatStatusMetricText}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chatWorkspaceGrid}>
        {mobile ? null : <aside className={styles.historyRail}>{renderConversationList()}</aside>}

        <section className={styles.chatMainColumn}>
          <div className={styles.chatSessionHeader}>
            <div className={styles.chatSessionHeaderMain}>
              <div className={styles.sectionEyebrow}>当前会话</div>
              <div className={styles.chatSessionTitle}>{currentConversationMeta.title}</div>
              <div className={styles.chatSessionMeta}>{currentConversationMeta.subtitle}</div>
            </div>
            <Space wrap className={styles.chatSessionActions}>
              {mobile ? (
                <>
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() => setHistoryDrawerOpen(true)}
                    disabled={chatting}
                  >
                    历史
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onResetChat}
                    disabled={chatting}
                  >
                    新会话
                  </Button>
                </>
              ) : null}
              {activeConversation ? (
                <>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => onStartRenameConversation(activeConversation)}
                    disabled={chatting}
                  >
                    重命名
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDeleteConversation(activeConversation)}
                    disabled={chatting}
                  >
                    删除
                  </Button>
                </>
              ) : null}
            </Space>
          </div>

          <div ref={chatSurfaceRef} className={styles.chatSurface}>
            {conversationDetailLoading ? (
              <div className={styles.chatLoadingState}>
                <Spin />
                <div className={styles.chatLoadingText}>正在加载历史会话...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className={styles.chatEmptyState}>
                <div className={styles.chatEmptyPanel}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={null} />
                  <div className={styles.chatEmptyTitle}>
                    {activeConversation ? '这条会话还没有可见消息' : '从一条新的问题开始'}
                  </div>
                  <div className={styles.chatEmptyText}>
                    {activeConversation
                      ? '继续补充追问后，新的往返会直接追加到这条共享历史里。'
                      : '可以围绕某篇文章、某个研究主题、某段草稿或某类技术关键词发问，让 AI 从博客知识中整理答案。'}
                  </div>
                  {!activeConversation ? (
                    <Space wrap className={styles.chatSuggestionRow}>
                      {suggestions.map((item) => (
                        <Button
                          key={item}
                          className={styles.chatSuggestionButton}
                          onClick={() => onQuestionChange(item)}
                        >
                          {item}
                        </Button>
                      ))}
                    </Space>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={styles.chatTimeline}>
                {messages.map((item) => {
                  const isAssistant = item.role === 'assistant';
                  const messageAuthor = isAssistant ? '博客助手' : getMessageAuthor(item);
                  return (
                    <div
                      key={item.id}
                      className={`${styles.chatMessageRow} ${
                        !isAssistant ? styles.chatMessageRowUser : ''
                      }`}
                    >
                      <div
                        className={`${styles.chatMessageCard} ${
                          !isAssistant ? styles.chatMessageCardUser : ''
                        }`}
                      >
                        <div className={styles.chatMessageTop}>
                          <div className={styles.chatMessageIdentity}>
                            <div className={styles.chatMessageRole}>{messageAuthor}</div>
                            <div className={styles.chatMessageSubRole}>
                              {isAssistant ? '优先参考博客知识' : '管理员提问'}
                            </div>
                          </div>
                          <div className={styles.chatMessageMeta}>
                            <ClockCircleOutlined />
                            <span>{formatTime(item.createdAt)}</span>
                            {isAssistant ? (
                              <span
                                className={`${styles.chatMessageState} ${
                                  item.grounded ? styles.chatMessageStateGrounded : ''
                                }`}
                              >
                                {item.grounded ? '附引用' : '未附引用'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {isAssistant ? (
                          <div className={styles.chatRichPane}>
                            <DocumentViewer value={item.content || ''} codeMaxLines={12} />
                          </div>
                        ) : (
                          <Paragraph className={styles.chatPlainText}>{item.content}</Paragraph>
                        )}

                        {isAssistant && item.citations?.length ? (
                          <div className={styles.citationBlock}>
                            <div className={styles.citationBlockHead}>
                              <Text strong>引用线索 {item.citations.length}</Text>
                              <Text type="secondary">可直接跳到后台编辑或公开页面</Text>
                            </div>
                            <div className={styles.citationList}>
                              {item.citations.map((citation, index) => (
                                <div
                                  key={`${citation.collectionId || citation.sourceId || citation.title}-${index}`}
                                  className={styles.citationItem}
                                >
                                  <div className={styles.citationItemHead}>
                                    <div className={styles.citationTitle}>{citation.title}</div>
                                    <div className={styles.citationMetaRow}>
                                      <Tag>{sourceTypeLabelMap[citation.sourceType] || '知识片段'}</Tag>
                                      <Tag icon={<SearchOutlined />} color="blue">
                                        分数 {renderScore(citation.score)}
                                      </Tag>
                                    </div>
                                  </div>
                                  {citation.question ? (
                                    <div className={styles.citationPair}>
                                      <span>问</span>
                                      <span>{citation.question}</span>
                                    </div>
                                  ) : null}
                                  {citation.answer ? (
                                    <div className={styles.citationPair}>
                                      <span>答</span>
                                      <span>{citation.answer}</span>
                                    </div>
                                  ) : null}
                                  <Space wrap className={styles.citationActions}>
                                    {citation.editorUrl ? (
                                      <Button
                                        size="small"
                                        className={styles.citationActionButton}
                                        onClick={() => window.open(citation.editorUrl, '_blank')}
                                      >
                                        打开后台编辑
                                      </Button>
                                    ) : null}
                                    {citation.publicUrl ? (
                                      <Button
                                        size="small"
                                        icon={<LinkOutlined />}
                                        className={styles.citationActionButton}
                                        onClick={() => window.open(citation.publicUrl, '_blank')}
                                      >
                                        打开公开页
                                      </Button>
                                    ) : null}
                                  </Space>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {chatting ? (
                  <div className={styles.chatTypingRow}>
                    <div className={styles.chatTypingCard}>
                      <div className={styles.chatMessageRole}>博客助手</div>
                      <div className={styles.chatTypingDots}>
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className={styles.chatPromptBar}>
            <div className={styles.chatPromptBarTitle}>提问建议</div>
            <div className={styles.chatPromptBarText}>
              直接问某篇文章、某个研究方向、某类关键词或某份草稿内容即可；如果问题超出博客已有记录，AI 也会明确区分博客事实与通用补充。
            </div>
          </div>

          <div className={styles.chatComposerDock}>
            <div className={styles.chatComposerHead}>
              <div className={styles.chatComposerState}>问题会追加到当前会话并自动保存</div>
              <div className={styles.chatComposerHint}>Enter 发送 · Shift + Enter 换行</div>
            </div>
            <Space.Compact
              className={`${styles.chatComposer} ${mobile ? styles.chatComposerMobile : ''}`}
            >
              <Input.TextArea
                value={question}
                disabled={conversationDetailLoading}
                onChange={(event) => onQuestionChange(event.target.value)}
                placeholder="例如：总结一下我博客里关于无人机巡检和相机模型的内容"
                autoSize={{ minRows: 3, maxRows: 6 }}
                onKeyDown={(event) => {
                  const nativeEvent = event.nativeEvent || {};
                  if (event.key !== 'Enter') {
                    return;
                  }
                  if (event.isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
                    return;
                  }
                  if (!event.shiftKey) {
                    event.preventDefault();
                    onAsk();
                  }
                }}
              />
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={chatting}
                onClick={onAsk}
                disabled={conversationDetailLoading}
              >
                发送
              </Button>
            </Space.Compact>
          </div>
        </section>
      </div>

      <Drawer
        title={`共享历史会话 ${conversationTotal ? `(${conversationTotal})` : ''}`}
        placement="left"
        width={mobile ? '100vw' : 420}
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      >
        {renderConversationList()}
      </Drawer>
    </div>
  );
}
