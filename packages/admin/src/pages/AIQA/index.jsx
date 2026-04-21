import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ResponsivePageTabs, { toPageContainerTabList } from '@/components/ResponsivePageTabs';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { useModel } from '@umijs/max';
import {
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import { Button, Form, Input, Modal, Space, Spin, Tag, Typography, message, theme } from 'antd';
import ConfigTab from './ConfigTab';
import ChatTab from './ChatTab';
import styles from './index.less';
import thinstyle from '../Welcome/index.less';
import {
  assertSuccessResponse,
  buildConfigPayload,
  defaultConfig,
  extractSecretState,
  formatTime,
  sanitizeConfigForForm,
} from './shared';
import {
  chatWithAIQA,
  deleteAIQAConversation,
  getAIQAConfig,
  getAIQAConversationDetail,
  getAIQAConversations,
  getAIQAStatus,
  provisionAIQAResources,
  renameAIQAConversation,
  syncAIQAFull,
  syncBundledAIQAModels,
  testBundledAIQAModels,
  testAIQAConnection,
  updateAIQAConfig,
} from '@/services/van-blog/ai-qa';

const { Paragraph, Title } = Typography;

const tabs = [
  {
    key: 'chat',
    label: '博客问答',
    shortLabel: '问答',
    icon: <MessageOutlined />,
  },
  {
    key: 'config',
    label: '配置中心',
    shortLabel: '配置',
    icon: <SettingOutlined />,
  },
];

const CONVERSATION_PAGE_SIZE = 20;

const formatSourceBreakdown = (counts = {}) =>
  `文章 ${counts.article ?? 0} / 草稿 ${counts.draft ?? 0} / 文档 ${counts.document ?? 0}`;

const pickConversationSummary = (conversation) => {
  if (!conversation) {
    return null;
  }
  return {
    id: conversation.id,
    chatId: conversation.chatId,
    title: conversation.title,
    createdByUserId: conversation.createdByUserId,
    createdByName: conversation.createdByName,
    createdByNickname: conversation.createdByNickname,
    messageCount: conversation.messageCount ?? 0,
    lastMessagePreview: conversation.lastMessagePreview || '',
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const upsertConversationAtTop = (list, conversation) => {
  if (!conversation?.id) {
    return list;
  }
  return [conversation, ...(list || []).filter((item) => item.id !== conversation.id)];
};

export default function AIQA() {
  const [form] = Form.useForm();
  const { mobile } = useAdminResponsive();
  const [tab, setTab] = useTab('chat', 'tab', tabs.map((item) => item.key));
  const { initialState } = useModel('@@initialState');
  const { token } = theme.useToken();
  const navTheme = initialState?.settings?.navTheme || '';
  const isDark = navTheme.toLowerCase().includes('dark');

  const [configLoading, setConfigLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [secretState, setSecretState] = useState({
    apiKeyConfigured: false,
    llmRequestAuthConfigured: false,
    embeddingRequestAuthConfigured: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncingBundledModels, setSyncingBundledModels] = useState(false);
  const [provisioningResources, setProvisioningResources] = useState(false);
  const [testingBundledModels, setTestingBundledModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [chatting, setChatting] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationList, setConversationList] = useState([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationListLoading, setConversationListLoading] = useState(false);
  const [conversationLoadingMore, setConversationLoadingMore] = useState(false);
  const [conversationDetailLoading, setConversationDetailLoading] = useState(false);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renamingConversation, setRenamingConversation] = useState(false);

  const extensionQueryEnabled = Form.useWatch('datasetSearchUsingExtensionQuery', form);

  const pageVars = useMemo(
    () => ({
      '--aiqa-page-bg': isDark
        ? 'linear-gradient(135deg, rgba(19, 28, 39, 0.98) 0%, rgba(18, 34, 52, 0.96) 42%, rgba(17, 30, 43, 0.98) 100%)'
        : 'linear-gradient(135deg, #f7fbff 0%, #eef6ff 48%, #f9fcf6 100%)',
      '--aiqa-hero-bg': isDark
        ? 'linear-gradient(135deg, rgba(24, 36, 51, 0.98) 0%, rgba(18, 32, 48, 0.94) 100%)'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 247, 255, 0.98) 100%)',
      '--aiqa-panel-bg': isDark ? 'rgba(17, 25, 36, 0.94)' : 'rgba(255, 255, 255, 0.92)',
      '--aiqa-panel-bg-strong': isDark ? 'rgba(23, 32, 45, 0.98)' : 'rgba(255, 255, 255, 0.98)',
      '--aiqa-border': isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)',
      '--aiqa-border-strong': isDark ? 'rgba(96, 165, 250, 0.22)' : 'rgba(22, 119, 255, 0.14)',
      '--aiqa-shadow': isDark
        ? '0 20px 40px rgba(2, 6, 23, 0.35)'
        : '0 20px 40px rgba(15, 23, 42, 0.08)',
      '--aiqa-shadow-soft': isDark
        ? '0 14px 28px rgba(2, 6, 23, 0.28)'
        : '0 14px 28px rgba(15, 23, 42, 0.06)',
      '--aiqa-text-main': token.colorText,
      '--aiqa-text-secondary': token.colorTextSecondary,
      '--aiqa-text-tertiary': isDark ? 'rgba(203, 213, 225, 0.76)' : 'rgba(71, 85, 105, 0.82)',
      '--aiqa-hero-accent': isDark ? '#78b6ff' : '#1677ff',
      '--aiqa-hero-accent-soft': isDark ? 'rgba(120, 182, 255, 0.16)' : 'rgba(22, 119, 255, 0.12)',
      '--aiqa-chat-surface': isDark ? 'rgba(10, 17, 27, 0.88)' : 'rgba(249, 251, 255, 0.92)',
      '--aiqa-assistant-bg': isDark ? 'rgba(24, 34, 47, 0.98)' : 'rgba(255, 255, 255, 0.96)',
      '--aiqa-user-bg': isDark
        ? 'linear-gradient(135deg, #0f67e8 0%, #5aa4ff 100%)'
        : 'linear-gradient(135deg, #0f67e8 0%, #4497ff 100%)',
      '--aiqa-citation-bg': isDark ? 'rgba(22, 33, 46, 0.98)' : 'rgba(246, 250, 255, 0.96)',
      '--aiqa-citation-border': isDark ? 'rgba(120, 177, 255, 0.24)' : 'rgba(120, 177, 255, 0.24)',
      '--aiqa-soft-fill': isDark ? 'rgba(148, 163, 184, 0.07)' : 'rgba(15, 23, 42, 0.035)',
      '--aiqa-warning-bg': isDark ? 'rgba(74, 48, 0, 0.42)' : 'rgba(255, 247, 230, 0.9)',
      '--aiqa-success-bg': isDark ? 'rgba(8, 64, 40, 0.42)' : 'rgba(240, 253, 244, 0.94)',
      '--aiqa-info-bg': isDark ? 'rgba(12, 56, 94, 0.34)' : 'rgba(239, 246, 255, 0.94)',
      '--aiqa-warning-border': isDark ? 'rgba(250, 173, 20, 0.22)' : 'rgba(250, 173, 20, 0.22)',
      '--aiqa-success-border': isDark ? 'rgba(82, 196, 26, 0.18)' : 'rgba(82, 196, 26, 0.2)',
      '--aiqa-info-border': isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(22, 119, 255, 0.2)',
      '--aiqa-rail-bg': isDark ? 'rgba(9, 15, 24, 0.62)' : 'rgba(247, 250, 255, 0.78)',
    }),
    [isDark, token.colorText, token.colorTextSecondary],
  );

  const applyConfigView = useCallback(
    (data) => {
      const nextConfig = {
        ...defaultConfig,
        ...(data || {}),
      };
      setSecretState(extractSecretState(nextConfig));
      form.setFieldsValue(sanitizeConfigForForm(nextConfig));
    },
    [form],
  );

  const fetchConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const data = assertSuccessResponse(await getAIQAConfig(), '获取 AI 问答配置失败');
      applyConfigView(data);
    } catch (error) {
      message.error(error.message || '获取 AI 问答配置失败');
      setSecretState({
        apiKeyConfigured: false,
        llmRequestAuthConfigured: false,
        embeddingRequestAuthConfigured: false,
      });
      form.setFieldsValue(defaultConfig);
    } finally {
      setConfigLoading(false);
    }
  }, [applyConfigView, form]);

  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const data = assertSuccessResponse(await getAIQAStatus(), '获取 AI 问答状态失败');
      setStatus(data);
    } catch (error) {
      message.error(error.message || '获取 AI 问答状态失败');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchConversationList = useCallback(async ({ page = 1, append = false } = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const loadingSetter = append ? setConversationLoadingMore : setConversationListLoading;
    try {
      loadingSetter(true);
      const data = assertSuccessResponse(
        await getAIQAConversations({ page: safePage, pageSize: CONVERSATION_PAGE_SIZE }),
        '获取历史会话失败',
      );
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setConversationPage(safePage);
      setConversationTotal(Number(data?.total || 0));
      setConversationList((current) => {
        if (!append) {
          return nextItems;
        }
        return [...current, ...nextItems.filter((item) => !current.some((it) => it.id === item.id))];
      });
    } catch (error) {
      message.error(error.message || '获取历史会话失败');
    } finally {
      loadingSetter(false);
    }
  }, []);

  const persistConfig = useCallback(
    async ({ successMessage, silent = false } = {}) => {
      const values = await form.validateFields();
      const payload = buildConfigPayload(values, secretState);
      setSavingConfig(true);
      try {
        const data = assertSuccessResponse(
          await updateAIQAConfig(payload),
          '保存 AI 问答配置失败',
        );
        applyConfigView(data);
        if (!silent && successMessage) {
          message.success(successMessage);
        }
        await fetchStatus();
        return data;
      } finally {
        setSavingConfig(false);
      }
    },
    [applyConfigView, fetchStatus, form, secretState],
  );

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchConversationList({ page: 1, append: false });
  }, [fetchConfig, fetchStatus, fetchConversationList]);

  const handleSaveConfig = async () => {
    try {
      await persistConfig({ successMessage: 'AI 问答配置已保存' });
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || '保存 AI 问答配置失败');
    }
  };

  const handleSyncBundledModels = async () => {
    try {
      await persistConfig({ silent: true });
      setSyncingBundledModels(true);
      const data = assertSuccessResponse(
        await syncBundledAIQAModels(),
        '同步 bundled FastGPT 模型失败',
      );
      message.success(
        `bundled FastGPT 模型已同步：对话模型 ${data.llm?.name || data.llm?.model}，向量模型 ${
          data.embedding?.name || data.embedding?.model
        }。`,
      );
      fetchStatus();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || '同步 bundled FastGPT 模型失败');
    } finally {
      setSyncingBundledModels(false);
    }
  };

  const handleTestBundledModels = async () => {
    try {
      await persistConfig({ silent: true });
      setTestingBundledModels(true);
      const data = assertSuccessResponse(
        await testBundledAIQAModels(),
        '测试 bundled FastGPT 模型失败',
      );
      message.success(
        `对话模型已返回：${data.llm?.preview || 'ok'}；向量维度：${
          data.embedding?.vectorLength || 0
        }。`,
      );
      fetchStatus();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || '测试 bundled FastGPT 模型失败');
    } finally {
      setTestingBundledModels(false);
    }
  };

  const handleProvisionResources = async () => {
    try {
      await persistConfig({ silent: true });
      setProvisioningResources(true);
      const data = assertSuccessResponse(
        await provisionAIQAResources(),
        '自动创建 FastGPT 资源失败',
      );
      if (data?.config) {
        applyConfigView(data.config);
      }
      if (data?.status) {
        setStatus(data.status);
      } else {
        fetchStatus();
      }
      message.success(
        `FastGPT 资源已就绪：知识库${
          data?.dataset?.action === 'created' ? '已新建' : '已复用'
        }，应用${data?.app?.action === 'created' ? '已新建' : '已更新'}，API Key${
          data?.apiKey?.action === 'created' ? '已新建' : '沿用现有'
        }。下一步可直接执行全量同步。`,
      );
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || '自动创建 FastGPT 资源失败');
    } finally {
      setProvisioningResources(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const data = assertSuccessResponse(await testAIQAConnection(), '测试 FastGPT 连接失败');
      message.success(
        `FastGPT 连接正常，检索命中 ${data.searchHitCount ?? 0} 条，聊天接口已响应。`,
      );
      fetchStatus();
    } catch (error) {
      message.error(error.message || '测试 FastGPT 连接失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFullSync = async () => {
    try {
      setSyncing(true);
      const data = assertSuccessResponse(await syncAIQAFull(), '执行全量同步失败');
      message.success(
        `全量同步完成：新增 ${data.created}，更新 ${data.updated}，跳过 ${data.skipped}，删除 ${data.deleted}。`,
      );
      fetchStatus();
    } catch (error) {
      message.error(error.message || '执行全量同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenConversation = async (conversationId) => {
    if (!conversationId || chatting) {
      return;
    }
    if (activeConversation?.id === conversationId) {
      return;
    }
    try {
      setConversationDetailLoading(true);
      const data = assertSuccessResponse(
        await getAIQAConversationDetail(conversationId),
        '获取会话详情失败',
      );
      setActiveConversation(pickConversationSummary(data));
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setQuestion('');
    } catch (error) {
      message.error(error.message || '获取会话详情失败');
    } finally {
      setConversationDetailLoading(false);
    }
  };

  const handleAsk = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      message.warning('请输入问题后再发送');
      return;
    }

    const optimisticUserMessage = {
      id: `pending-user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion,
      grounded: false,
      citations: [],
      createdAt: new Date().toISOString(),
      createdByNickname: initialState?.user?.nickname || undefined,
    };

    setMessages((current) => [...current, optimisticUserMessage]);
    setQuestion('');
    setChatting(true);

    try {
      const data = assertSuccessResponse(
        await chatWithAIQA({
          conversationId: activeConversation?.id || undefined,
          question: trimmedQuestion,
        }),
        'AI 问答失败',
      );
      const nextConversation = pickConversationSummary(data?.conversation) || activeConversation;
      const savedUserMessage = data?.userMessage || {
        ...optimisticUserMessage,
        id: optimisticUserMessage.id,
      };
      const assistantMessage = data?.assistantMessage || {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.answer || '',
        grounded: Boolean(data?.grounded),
        citations: data?.citations || [],
        createdAt: new Date().toISOString(),
      };
      setActiveConversation(nextConversation || null);
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticUserMessage.id),
        savedUserMessage,
        assistantMessage,
      ]);
      if (nextConversation) {
        const conversationExists = conversationList.some((item) => item.id === nextConversation.id);
        setConversationList((current) => upsertConversationAtTop(current, nextConversation));
        setConversationTotal((current) => (conversationExists ? current : current + 1));
      }
    } catch (error) {
      message.error(error.message || 'AI 问答失败');
      setMessages((current) => current.filter((item) => item.id !== optimisticUserMessage.id));
      setQuestion(trimmedQuestion);
    } finally {
      setChatting(false);
    }
  };

  const handleResetChat = useCallback(() => {
    if (chatting) {
      return;
    }
    setActiveConversation(null);
    setMessages([]);
    setQuestion('');
  }, [chatting]);

  const handleLoadMoreConversations = useCallback(() => {
    if (conversationLoadingMore || conversationListLoading) {
      return;
    }
    if (conversationList.length >= conversationTotal) {
      return;
    }
    fetchConversationList({ page: conversationPage + 1, append: true });
  }, [
    conversationList.length,
    conversationListLoading,
    conversationLoadingMore,
    conversationPage,
    conversationTotal,
    fetchConversationList,
  ]);

  const handleStartRenameConversation = useCallback((conversation) => {
    if (!conversation) {
      return;
    }
    setRenameTarget(conversation);
    setRenameTitle(conversation.title || '');
    setRenameModalOpen(true);
  }, []);

  const handleRenameConversation = useCallback(async () => {
    if (!renameTarget?.id) {
      return;
    }
    const nextTitle = renameTitle.trim();
    if (!nextTitle) {
      message.warning('请输入会话标题');
      return;
    }
    try {
      setRenamingConversation(true);
      const data = assertSuccessResponse(
        await renameAIQAConversation(renameTarget.id, { title: nextTitle }),
        '重命名会话失败',
      );
      setConversationList((current) =>
        current.map((item) => (item.id === data.id ? { ...item, ...data } : item)),
      );
      setActiveConversation((current) => (current?.id === data.id ? { ...current, ...data } : current));
      setRenameModalOpen(false);
      setRenameTarget(null);
      setRenameTitle('');
      message.success('会话标题已更新');
    } catch (error) {
      message.error(error.message || '重命名会话失败');
    } finally {
      setRenamingConversation(false);
    }
  }, [renameTarget, renameTitle]);

  const handleDeleteConversation = useCallback(
    (conversation) => {
      if (!conversation?.id) {
        return;
      }
      Modal.confirm({
        title: '删除这条会话？',
        content: '删除后会从共享历史里移除，但不会影响 FastGPT 侧既有聊天记录。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        async onOk() {
          const data = assertSuccessResponse(
            await deleteAIQAConversation(conversation.id),
            '删除会话失败',
          );
          const deletingActive = activeConversation?.id === data.id;
          setConversationList((current) => current.filter((item) => item.id !== data.id));
          setConversationTotal((current) => Math.max(0, current - 1));
          if (deletingActive) {
            setActiveConversation(null);
            setMessages([]);
            setQuestion('');
          }
          message.success('会话已删除');
        },
      });
    },
    [activeConversation],
  );

  const statusTag = useMemo(() => {
    if (!status) {
      return null;
    }
    if (!status.configured) {
      return <Tag color="orange">待配置</Tag>;
    }
    if (status.enabled) {
      return <Tag color="green">已启用</Tag>;
    }
    return <Tag color="default">已配置但未启用</Tag>;
  }, [status]);

  const syncSummary = status?.lastSyncSummary;
  const sourceSummary = formatSourceBreakdown(status?.sourceCounts);
  const syncedSummary = formatSourceBreakdown(status?.syncedCounts);

  const overviewItems = useMemo(() => {
    if (tab === 'chat') {
      return [
        {
          key: 'sources',
          label: '博客知识源',
          value: status?.totalSources ?? 0,
          sub: sourceSummary,
        },
        {
          key: 'sync',
          label: '同步状态',
          value: `${status?.syncedSources ?? 0} / ${status?.totalSources ?? 0}`,
          sub:
            status?.pendingSources > 0
              ? `仍有 ${status.pendingSources} 条待同步`
              : `最近同步 ${formatTime(status?.lastFullSyncAt || status?.lastSyncAt)}`,
        },
        {
          key: 'history',
          label: '共享历史',
          value: conversationTotal,
          sub: conversationTotal ? '支持继续追问、重命名、删除' : '还没有共享会话',
        },
        {
          key: 'focus',
          label: '当前焦点',
          value: activeConversation ? '历史会话' : '新会话',
          sub: activeConversation?.title || '准备开始一轮新的提问',
        },
      ];
    }

    return [
      {
        key: 'dataset',
        label: 'FastGPT 知识库',
        value: status?.datasetId ? '已绑定' : '未绑定',
        sub: status?.datasetId || '等待初始化',
      },
      {
        key: 'app',
        label: 'FastGPT 应用',
        value: status?.appId ? '已连接' : '未连接',
        sub: status?.appId || '等待初始化',
      },
      {
        key: 'pending',
        label: '待同步',
        value: status?.pendingSources ?? 0,
        sub:
          status?.pendingSources > 0
            ? `已同步 ${status?.syncedSources ?? 0} · ${syncedSummary}`
            : `最近全量同步 ${formatTime(status?.lastFullSyncAt)}`,
      },
      {
        key: 'bundled',
        label: 'bundled 模型',
        value: status?.bundledModelConfigured ? '已填写' : '待填写',
        sub: status?.fastgptRootPasswordConfigured ? '可直接同步到 FastGPT' : '当前仅可测上游接口',
      },
    ];
  }, [activeConversation, conversationTotal, sourceSummary, status, syncedSummary, tab]);

  const heroContent = useMemo(() => {
    if (tab === 'chat') {
      return {
        title: '博客知识 AI 工作台',
        description:
          '在一个共享工作区里发问、继续追问、查看引用，让管理员围绕博客知识形成可复盘的对话历史。',
        tags: [
          { key: 'private', color: 'blue', text: '仅后台可见' },
          { key: 'scope', color: 'cyan', text: '博客增强回答' },
          { key: 'shared', color: 'processing', text: '管理员共享历史' },
        ],
      };
    }

    return {
      title: 'FastGPT 配置与运维中心',
      description:
        '在同一路由里管理资源绑定、检索策略、模型接入和同步状态，不用在多个后台之间来回切换。',
      tags: [
        status?.fastgptRootPasswordConfigured
          ? { key: 'bundled', color: 'blue', text: '可写 bundled FastGPT' }
          : { key: 'upstream', color: 'default', text: '仅上游测试' },
        status?.bundledModelConfigured
          ? { key: 'model', color: 'cyan', text: '模型配置已填写' }
          : { key: 'model', color: 'default', text: '等待模型接入' },
        syncSummary
          ? { key: 'sync', color: 'processing', text: `最近同步 ${syncSummary.trigger}` }
          : null,
      ].filter(Boolean),
    };
  }, [status?.bundledModelConfigured, status?.fastgptRootPasswordConfigured, syncSummary, tab]);

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className={`${thinstyle.thinheader} ${styles.aiqaPageContainer}`}
      tabActiveKey={tab}
      tabList={mobile ? undefined : toPageContainerTabList(tabs)}
      onTabChange={setTab}
    >
      <Spin spinning={configLoading && !status}>
        <div className={styles.aiqaPage} style={pageVars}>
          <div className={styles.heroCard}>
            <div className={styles.heroMain}>
              <div className={styles.heroCopy}>
                <div className={styles.heroEyebrow}>
                  <RobotOutlined />
                  AI 工作台
                </div>
                <Title level={2} className={styles.heroTitle}>
                  {heroContent.title}
                </Title>
                <Paragraph className={styles.heroDesc}>{heroContent.description}</Paragraph>
              </div>
              <div className={styles.heroAside}>
                <div className={styles.heroMeta}>
                  {statusTag}
                  {heroContent.tags.map((item) => (
                    <Tag key={item.key} color={item.color}>
                      {item.text}
                    </Tag>
                  ))}
                </div>
                <Space wrap className={styles.heroActions}>
                  {tab === 'chat' ? (
                    <>
                      <Button icon={<SettingOutlined />} onClick={() => setTab('config')}>
                        配置中心
                      </Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleResetChat}>
                        新会话
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button icon={<ReloadOutlined />} onClick={fetchStatus} loading={statusLoading}>
                        刷新状态
                      </Button>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSaveConfig}
                        loading={savingConfig}
                      >
                        保存配置
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            </div>

            <div className={styles.kpiGrid}>
              {overviewItems.map((item) => (
                <div className={styles.kpiCard} key={item.key}>
                  <div className={styles.kpiLabel}>{item.label}</div>
                  <div className={styles.kpiValue}>{item.value}</div>
                  <div className={styles.kpiSub}>{item.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {mobile ? <ResponsivePageTabs items={tabs} activeKey={tab} onChange={setTab} /> : null}

          {tab === 'config' ? (
            <ConfigTab
              form={form}
              status={status}
              syncSummary={syncSummary}
              secretState={secretState}
              extensionQueryEnabled={extensionQueryEnabled}
              savingConfig={savingConfig}
              statusLoading={statusLoading}
              testingConnection={testingConnection}
              syncing={syncing}
              syncingBundledModels={syncingBundledModels}
              provisioningResources={provisioningResources}
              testingBundledModels={testingBundledModels}
              onSaveConfig={handleSaveConfig}
              onRefreshStatus={fetchStatus}
              onTestConnection={handleTestConnection}
              onFullSync={handleFullSync}
              onSyncBundledModels={handleSyncBundledModels}
              onProvisionResources={handleProvisionResources}
              onTestBundledModels={handleTestBundledModels}
            />
          ) : (
            <ChatTab
              mobile={mobile}
              status={status}
              activeConversation={activeConversation}
              conversationList={conversationList}
              conversationTotal={conversationTotal}
              conversationLoading={conversationListLoading}
              conversationLoadingMore={conversationLoadingMore}
              conversationDetailLoading={conversationDetailLoading}
              messages={messages}
              question={question}
              chatting={chatting}
              onQuestionChange={setQuestion}
              onAsk={handleAsk}
              onResetChat={handleResetChat}
              onOpenConversation={handleOpenConversation}
              onLoadMoreConversations={handleLoadMoreConversations}
              onStartRenameConversation={handleStartRenameConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          )}
        </div>
      </Spin>

      <Modal
        title="重命名会话"
        open={renameModalOpen}
        onOk={handleRenameConversation}
        okText="保存"
        confirmLoading={renamingConversation}
        onCancel={() => {
          if (renamingConversation) {
            return;
          }
          setRenameModalOpen(false);
          setRenameTarget(null);
          setRenameTitle('');
        }}
      >
        <Input
          autoFocus
          prefix={<EditOutlined />}
          maxLength={40}
          value={renameTitle}
          onChange={(event) => setRenameTitle(event.target.value)}
          placeholder="输入新的会话标题"
          onPressEnter={handleRenameConversation}
        />
      </Modal>
    </PageContainer>
  );
}
