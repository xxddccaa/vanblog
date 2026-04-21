export const SECRET_PLACEHOLDER = '********';

export const defaultConfig = {
  enabled: false,
  datasetId: '',
  appId: '',
  apiKey: '',
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
  datasetId:
    'FastGPT 知识库 ID。VanBlog 会把文章、草稿和私密文档同步到这个 Dataset 中。',
  appId:
    'FastGPT 应用 ID。后台问答会调用这个 App，聊天鉴权会自动组合成 apiKey-appId。',
  apiKey:
    'FastGPT OpenAPI Key。页面不会回显真实值；输入新值会覆盖，留空则默认沿用当前已保存密钥。',
  queryExtension:
    '先让扩写模型改写用户问题，再用改写后的问题做检索。适合缩写多、术语多的知识库，但会增加时延与 token 消耗。',
  bundledToken:
    '这是上游 OpenAI-compatible 接口的 Bearer Token。页面不会回显真实值；输入新值会覆盖，留空则沿用当前已保存 Token。',
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
