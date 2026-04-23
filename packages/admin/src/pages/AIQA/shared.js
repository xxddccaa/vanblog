export const SECRET_PLACEHOLDER = '********';

export const defaultConfig = {
  enabled: false,
  datasetId: '',
  appId: '',
  apiKey: '',
  blogInstanceId: '',
  resourceManagementMode: 'manual',
  resourceNamingVersion: 2,
  managedResourceNames: undefined,
  legacyAutoMigrationPending: false,
  searchMode: 'mixedRecall',
  limit: 5000,
  similarity: 0,
  usingReRank: false,
  datasetSearchUsingExtensionQuery: false,
  datasetSearchExtensionModel: '',
  datasetSearchExtensionBg: '',
  bundledModels: {
    llm: {
      requestUrl: '',
      requestAuth: '',
      model: '',
      name: '',
    },
    embedding: {
      requestUrl: '',
      requestAuth: '',
      model: '',
      name: '',
    },
  },
};

export const sourceTypeLabelMap = {
  article: '文章',
  draft: '草稿',
  document: '私密文档',
};

export const fieldTips = {
  enabled: '关闭后不会清空已保存配置，但后台 AI 问答入口会停止提供问答能力。',
  datasetId: 'FastGPT 知识库 ID。VanBlog 会把文章、草稿和私密文档同步到这个 Dataset 中。',
  appId: 'FastGPT 应用 ID。后台问答会调用这个 App，聊天鉴权会自动组合成 apiKey-appId。',
  apiKey: 'FastGPT OpenAPI Key。页面不会回显真实值；输入新值会覆盖，留空则默认沿用当前已保存密钥。',
  searchMode: '决定 FastGPT 检索博客知识的方式。一般先用 mixedRecall，结果不理想再微调。',
  limit: '控制一次问答最多带入多少上下文 Token。过小可能漏信息，过大可能增加成本与延迟。',
  similarity: '最小相似度阈值。值越高越严格，值越低越容易召回更多内容。',
  usingReRank: '对召回结果做二次排序。通常能提升相关性，但会增加一点耗时。',
  queryExtension:
    '先让扩写模型改写用户问题，再用改写后的问题做检索。适合缩写多、术语多的知识库，但会增加时延与 token 消耗。',
  extensionModel: '用于问题扩写的模型标识。只有启用 Query Extension 后才需要填写。',
  extensionBackground:
    '补充博客常见术语、缩写、栏目名或研究方向，帮助扩写模型更懂你的内容上下文。',
  modelDisplayName: '展示给 FastGPT 或后台的模型名称，便于你自己识别。',
  modelKey: '实际调用时使用的模型标识，通常填写上游服务要求的 model 值。',
  chatRequestUrl: '填写完整的 OpenAI-compatible chat 接口地址，必须以 /chat/completions 结尾。',
  embeddingRequestUrl: '填写完整的 OpenAI-compatible embedding 接口地址，必须以 /embeddings 结尾。',
  bundledToken:
    '这是上游 OpenAI-compatible 接口的 Bearer Token。页面不会回显真实值；输入新值会覆盖，留空则沿用当前已保存 Token。',
  fullSync:
    '把当前允许进入知识库的文章、草稿和私密文档重新同步到 FastGPT。首次接入或模型变更后建议执行一次。',
  syncBundledModels:
    '把当前页面填写的 chat / embedding 模型配置写入 bundled FastGPT。需要已注入 FastGPT root 密码。',
  provisionResources:
    '自动创建或复用 Dataset、App 和 API Key。适合 bundled FastGPT 场景；已有资源时会尽量复用。',
  rootPassword:
    '只有注入 FastGPT root 密码后，后台才能把模型写入 bundled FastGPT，或自动创建 Dataset / App / API Key。',
};

export const getResponseMessage = (response, fallbackMessage) => {
  if (!response) {
    return fallbackMessage;
  }
  if (typeof response === 'string') {
    return response;
  }
  return response.message || response.data?.message || fallbackMessage;
};

export const assertSuccessResponse = (response, fallbackMessage) => {
  if (!response || response.statusCode !== 200) {
    throw new Error(getResponseMessage(response, fallbackMessage));
  }
  return response.data;
};

export const formatTime = (value) => {
  if (!value) {
    return '未记录';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN');
};

export const renderScore = (score) => {
  if (typeof score !== 'number') {
    return '未知';
  }
  return score.toFixed(3);
};

export const extractSecretState = (configView = {}) => ({
  apiKeyConfigured: Boolean(configView?.apiKeyConfigured),
  llmRequestAuthConfigured: Boolean(configView?.bundledModels?.llm?.requestAuthConfigured),
  embeddingRequestAuthConfigured: Boolean(
    configView?.bundledModels?.embedding?.requestAuthConfigured,
  ),
});

export const sanitizeConfigForForm = (configView = {}) => ({
  ...defaultConfig,
  ...(configView || {}),
  apiKey: '',
  bundledModels: {
    llm: {
      ...defaultConfig.bundledModels.llm,
      ...(configView?.bundledModels?.llm || {}),
      requestAuth: '',
    },
    embedding: {
      ...defaultConfig.bundledModels.embedding,
      ...(configView?.bundledModels?.embedding || {}),
      requestAuth: '',
    },
  },
});

export const normalizeResourceManagementMode = (mode) =>
  mode === 'managedV2' ? 'managedV2' : 'manual';

export const getResourceManagementModeLabel = (mode) =>
  normalizeResourceManagementMode(mode) === 'managedV2'
    ? 'managedV2 · 自动管理'
    : 'manual · 手工 / 旧配置';

export const shouldTriggerSilentLegacyMigration = (status, attemptedKeys = new Set()) => {
  if (!status?.legacyAutoMigrationPending) {
    return false;
  }
  const attemptKey = status?.blogInstanceId || status?.datasetId || 'default';
  return !attemptedKeys.has(attemptKey);
};

const keepOrReplaceSecret = (nextValue, configured) => {
  if (nextValue) {
    return nextValue;
  }

  if (configured) {
    return SECRET_PLACEHOLDER;
  }

  return '';
};

export const buildConfigPayload = (values, secretState) => ({
  ...values,
  apiKey: keepOrReplaceSecret(values?.apiKey, secretState?.apiKeyConfigured),
  bundledModels: {
    llm: {
      ...(values?.bundledModels?.llm || {}),
      requestAuth: keepOrReplaceSecret(
        values?.bundledModels?.llm?.requestAuth,
        secretState?.llmRequestAuthConfigured,
      ),
    },
    embedding: {
      ...(values?.bundledModels?.embedding || {}),
      requestAuth: keepOrReplaceSecret(
        values?.bundledModels?.embedding?.requestAuth,
        secretState?.embeddingRequestAuthConfigured,
      ),
    },
  },
});
