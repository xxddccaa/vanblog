import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash, randomUUID } from 'crypto';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { config } from 'src/config';
import { Setting, SettingDocument } from 'src/scheme/setting.schema';
import { StructuredDataService } from 'src/storage/structured-data.service';
import {
  AiKnowledgeSyncRecord,
  AiQaBundledModelConfig,
  AiQaBundledModelConfigItem,
  AiQaChatResponse,
  AiQaCitation,
  AiQaConversationActor,
  AiQaConversationDetail,
  AiQaConversationListResponse,
  AiQaConversationMessage,
  AiQaConversationRecord,
  AiQaConversationSummary,
  AiQaMessageRecord,
  AiQaConfig,
  AiQaConfigView,
  AiQaLegacyMigrationResult,
  AiQaManagedResourceNames,
  AiQaKnowledgeSource,
  AiQaProvisionResult,
  AiQaResourceManagementMode,
  AiQaSourceType,
  AiQaStatus,
  AiQaSyncSummary,
  FastgptSearchMode,
  defaultAiQaConfig,
} from 'src/types/ai-qa.dto';
import { ArticleProvider } from '../article/article.provider';
import { DocumentProvider } from '../document/document.provider';
import { DraftProvider } from '../draft/draft.provider';
import { MetaProvider } from '../meta/meta.provider';

const AI_QA_SETTING_TYPE = 'aiQa';
const SECRET_MASK = '********';
const FASTGPT_DATASET_NAME = 'VanBlog AI 问答知识库';
const FASTGPT_DATASET_INTRO = 'VanBlog 自动创建的博客知识库，用于后台 AI 问答检索。';
const FASTGPT_APP_NAME = 'VanBlog AI 问答';
const FASTGPT_APP_INTRO = 'VanBlog 自动维护的博客知识问答应用。';
const FASTGPT_API_KEY_NAME = 'VanBlog AI Key';
const AI_QA_RESOURCE_NAMING_VERSION = 2 as const;
const FASTGPT_APP_SYSTEM_PROMPT =
  '你是 VanBlog 的博客知识助手。知识库检索结果用于辅助回答站长关于博客内容的问题。请优先参考博客知识回答；当知识库没有直接覆盖问题时，可以结合通用知识做必要补充，但要明确区分哪些是博客里明确提到的内容、哪些是基于常识的补充判断，不要把补充内容说成博客原文，也不要编造博客中不存在的事实。';

@Injectable()
export class AiQaProvider {
  private readonly logger = new Logger(AiQaProvider.name);
  private syncQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
    private readonly articleProvider: ArticleProvider,
    private readonly draftProvider: DraftProvider,
    private readonly documentProvider: DocumentProvider,
    private readonly structuredDataService: StructuredDataService,
    private readonly metaProvider: MetaProvider,
  ) {}

  private async enqueueSync<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.syncQueue;
    let release!: () => void;
    this.syncQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
    }
  }

  private normalizeFastgptInternalUrl(url: string) {
    const normalized = String(url || '')
      .trim()
      .replace(/\/+$/, '');
    if (!normalized) {
      return '';
    }
    return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized;
  }

  private normalizeAdminEditorUrl(url: string) {
    const normalized = String(url || '').trim();
    if (!normalized) {
      return '';
    }
    if (normalized.startsWith('/admin/')) {
      return normalized;
    }
    if (normalized.startsWith('/editor')) {
      return `/admin${normalized}`;
    }
    return normalized;
  }

  private normalizeSearchMode(value: unknown): FastgptSearchMode {
    const normalized = String(value || '').trim();
    if (
      normalized === 'embedding' ||
      normalized === 'fullTextRecall' ||
      normalized === 'mixedRecall'
    ) {
      return normalized;
    }
    return defaultAiQaConfig.searchMode;
  }

  private clampLimit(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return defaultAiQaConfig.limit;
    }
    return Math.min(20000, Math.max(100, Math.trunc(parsed)));
  }

  private clampSimilarity(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return defaultAiQaConfig.similarity;
    }
    return Math.min(1, Math.max(0, parsed));
  }

  private normalizeBundledModelConfigItem(
    rawValue?: Partial<AiQaBundledModelConfigItem> | null,
  ): AiQaBundledModelConfigItem {
    return {
      requestUrl: String(rawValue?.requestUrl || '').trim(),
      requestAuth: String(rawValue?.requestAuth || '').trim(),
      model: String(rawValue?.model || '').trim(),
      name: String(rawValue?.name || '').trim(),
    };
  }

  private normalizeBundledModelConfig(
    rawValue?: Partial<AiQaBundledModelConfig> | null,
  ): AiQaBundledModelConfig {
    return {
      llm: this.normalizeBundledModelConfigItem(rawValue?.llm),
      embedding: this.normalizeBundledModelConfigItem(rawValue?.embedding),
    };
  }

  private normalizeManagedResourceNames(
    rawValue?: Partial<AiQaManagedResourceNames> | null,
  ): AiQaManagedResourceNames | undefined {
    const dataset = String(rawValue?.dataset || '').trim();
    const app = String(rawValue?.app || '').trim();
    const apiKey = String(rawValue?.apiKey || '').trim();
    if (!dataset && !app && !apiKey) {
      return undefined;
    }
    return {
      dataset,
      app,
      apiKey,
    };
  }

  private normalizeResourceManagementMode(value: unknown): AiQaResourceManagementMode | undefined {
    const normalized = String(value || '').trim();
    if (normalized === 'manual' || normalized === 'managedV2') {
      return normalized;
    }
    return undefined;
  }

  private resolveResourceManagementMode(aiQaConfig: AiQaConfig): AiQaResourceManagementMode {
    return aiQaConfig.resourceManagementMode || 'manual';
  }

  private normalizeConfig(rawValue?: Partial<AiQaConfig> | null): AiQaConfig {
    const runtime = {
      ...(defaultAiQaConfig.runtime || {}),
      ...((rawValue?.runtime as any) || {}),
    };

    return {
      ...defaultAiQaConfig,
      ...(rawValue || {}),
      enabled: Boolean(rawValue?.enabled),
      datasetId: String(rawValue?.datasetId || '').trim(),
      appId: String(rawValue?.appId || '').trim(),
      apiKey: String(rawValue?.apiKey || '').trim(),
      blogInstanceId: String(rawValue?.blogInstanceId || '').trim(),
      resourceManagementMode: this.normalizeResourceManagementMode(
        rawValue?.resourceManagementMode,
      ),
      resourceNamingVersion: AI_QA_RESOURCE_NAMING_VERSION,
      managedResourceNames: this.normalizeManagedResourceNames(rawValue?.managedResourceNames),
      legacyAutoMigrationPending: Boolean(rawValue?.legacyAutoMigrationPending),
      searchMode: this.normalizeSearchMode(rawValue?.searchMode),
      limit: this.clampLimit(rawValue?.limit),
      similarity: this.clampSimilarity(rawValue?.similarity),
      usingReRank: Boolean(rawValue?.usingReRank),
      datasetSearchUsingExtensionQuery: Boolean(rawValue?.datasetSearchUsingExtensionQuery),
      datasetSearchExtensionModel: String(rawValue?.datasetSearchExtensionModel || '').trim(),
      datasetSearchExtensionBg: String(rawValue?.datasetSearchExtensionBg || '').trim(),
      bundledModels: this.normalizeBundledModelConfig(rawValue?.bundledModels),
      runtime,
    };
  }

  private buildConfigView(aiQaConfig: AiQaConfig): AiQaConfigView {
    return {
      ...aiQaConfig,
      apiKey: aiQaConfig.apiKey ? SECRET_MASK : '',
      apiKeyConfigured: Boolean(aiQaConfig.apiKey),
      fastgptInternalUrl: this.normalizeFastgptInternalUrl(config.fastgptInternalUrl),
      fastgptRootPasswordConfigured: Boolean(String(config.fastgptRootPassword || '').trim()),
      resourceManagementMode: this.resolveResourceManagementMode(aiQaConfig),
      bundledModels: {
        llm: {
          ...aiQaConfig.bundledModels.llm,
          requestAuth: aiQaConfig.bundledModels.llm.requestAuth ? SECRET_MASK : '',
          requestAuthConfigured: Boolean(aiQaConfig.bundledModels.llm.requestAuth),
        },
        embedding: {
          ...aiQaConfig.bundledModels.embedding,
          requestAuth: aiQaConfig.bundledModels.embedding.requestAuth ? SECRET_MASK : '',
          requestAuthConfigured: Boolean(aiQaConfig.bundledModels.embedding.requestAuth),
        },
      },
    };
  }

  private async readConfigRecord() {
    const structuredRecord = await this.structuredDataService.getSetting(AI_QA_SETTING_TYPE);
    if (structuredRecord) {
      return structuredRecord as any;
    }
    return await this.settingModel.findOne({ type: AI_QA_SETTING_TYPE }).lean().exec();
  }

  private async readConfig(): Promise<AiQaConfig> {
    const record = await this.readConfigRecord();
    return this.normalizeConfig(record?.value || null);
  }

  private async persistConfig(nextConfig: AiQaConfig) {
    await this.settingModel.updateOne(
      { type: AI_QA_SETTING_TYPE },
      {
        type: AI_QA_SETTING_TYPE,
        value: nextConfig,
        updatedAt: new Date(),
      },
      { upsert: true },
    );
    await this.structuredDataService.upsertSetting(AI_QA_SETTING_TYPE, nextConfig);
    return nextConfig;
  }

  private hasFastgptRootPasswordConfigured() {
    return Boolean(String(config.fastgptRootPassword || '').trim());
  }

  private async ensureBlogInstanceId(aiQaConfig: AiQaConfig) {
    if (aiQaConfig.blogInstanceId) {
      return aiQaConfig;
    }
    const nextConfig = this.normalizeConfig({
      ...aiQaConfig,
      blogInstanceId: randomUUID(),
    });
    await this.persistConfig(nextConfig);
    return nextConfig;
  }

  private sanitizeManagedSiteLabel(value: string) {
    const normalized = String(value || '')
      .normalize('NFKC')
      .trim()
      .replace(/[\/\\]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 48);
    return normalized || 'blog';
  }

  private async resolveManagedSiteLabel() {
    const siteInfo = ((await this.metaProvider.getSiteInfo()) || {}) as Record<string, any>;
    const baseUrl = String(siteInfo?.baseUrl || '').trim();
    if (baseUrl) {
      try {
        const hostname = new URL(baseUrl).hostname;
        if (hostname) {
          return this.sanitizeManagedSiteLabel(hostname);
        }
      } catch {
        // ignore invalid baseUrl and continue to siteName fallback
      }
    }
    const siteName = String(siteInfo?.siteName || '').trim();
    if (siteName) {
      return this.sanitizeManagedSiteLabel(siteName);
    }
    return 'blog';
  }

  private buildManagedResourceNames(
    blogInstanceId: string,
    siteLabel: string,
  ): AiQaManagedResourceNames {
    return {
      dataset: `${FASTGPT_DATASET_NAME} / ${siteLabel} / ${blogInstanceId}`,
      app: `${FASTGPT_APP_NAME} / ${siteLabel} / ${blogInstanceId}`,
      apiKey: `${FASTGPT_API_KEY_NAME} / ${siteLabel} / ${blogInstanceId}`,
    };
  }

  private async resolveManagedResourceNames(aiQaConfig: AiQaConfig) {
    const siteLabel = await this.resolveManagedSiteLabel();
    return this.buildManagedResourceNames(aiQaConfig.blogInstanceId, siteLabel);
  }

  private getMissingConfigFields(aiQaConfig: AiQaConfig) {
    const missing: string[] = [];
    if (!this.normalizeFastgptInternalUrl(config.fastgptInternalUrl)) {
      missing.push('fastgptInternalUrl');
    }
    if (!aiQaConfig.datasetId) {
      missing.push('datasetId');
    }
    if (!aiQaConfig.appId) {
      missing.push('appId');
    }
    if (!aiQaConfig.apiKey) {
      missing.push('apiKey');
    }
    return missing;
  }

  private getBundledModelMissingFields(aiQaConfig: AiQaConfig) {
    const missing: string[] = [];

    if (!aiQaConfig.bundledModels?.llm?.requestUrl) {
      missing.push('bundledModels.llm.requestUrl');
    }
    if (!aiQaConfig.bundledModels?.llm?.model) {
      missing.push('bundledModels.llm.model');
    }
    if (!aiQaConfig.bundledModels?.llm?.name) {
      missing.push('bundledModels.llm.name');
    }
    if (!aiQaConfig.bundledModels?.embedding?.requestUrl) {
      missing.push('bundledModels.embedding.requestUrl');
    }
    if (!aiQaConfig.bundledModels?.embedding?.model) {
      missing.push('bundledModels.embedding.model');
    }
    if (!aiQaConfig.bundledModels?.embedding?.name) {
      missing.push('bundledModels.embedding.name');
    }

    return missing;
  }

  private assertConfigReady(aiQaConfig: AiQaConfig, options: { requireEnabled?: boolean } = {}) {
    const missing = this.getMissingConfigFields(aiQaConfig);
    if (missing.length) {
      throw new BadRequestException(`AI 问答配置缺失: ${missing.join(', ')}`);
    }
    if (options.requireEnabled && !aiQaConfig.enabled) {
      throw new BadRequestException('AI 问答尚未启用，请先在后台保存并启用配置');
    }
  }

  private assertBundledModelSyncReady(aiQaConfig: AiQaConfig) {
    const missing: string[] = [];

    if (!this.normalizeFastgptInternalUrl(config.fastgptInternalUrl)) {
      missing.push('fastgptInternalUrl');
    }
    if (!String(config.fastgptRootPassword || '').trim()) {
      missing.push('fastgptRootPassword');
    }
    missing.push(...this.getBundledModelMissingFields(aiQaConfig));

    if (missing.length) {
      throw new BadRequestException(`Bundled FastGPT 模型配置缺失: ${missing.join(', ')}`);
    }
  }

  private assertBundledModelTestReady(aiQaConfig: AiQaConfig) {
    const missing = this.getBundledModelMissingFields(aiQaConfig);
    if (missing.length) {
      throw new BadRequestException(`Bundled FastGPT 模型配置缺失: ${missing.join(', ')}`);
    }
  }

  private getDatasetAuthorization(aiQaConfig: AiQaConfig) {
    return aiQaConfig.apiKey;
  }

  private getChatAuthorization(aiQaConfig: AiQaConfig) {
    if (!aiQaConfig.appId) {
      return aiQaConfig.apiKey;
    }
    if (aiQaConfig.apiKey.endsWith(`-${aiQaConfig.appId}`)) {
      return aiQaConfig.apiKey;
    }
    return `${aiQaConfig.apiKey}-${aiQaConfig.appId}`;
  }

  private getFastgptEndpoint(pathname: string) {
    const baseUrl = this.normalizeFastgptInternalUrl(config.fastgptInternalUrl);
    return `${baseUrl}${pathname}`;
  }

  private async postFastgpt(pathname: string, body: any, authorization: string) {
    try {
      const response = await axios.post(this.getFastgptEndpoint(pathname), body, {
        timeout: 60000,
        headers: {
          Authorization: `Bearer ${authorization}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      throw new BadRequestException(`FastGPT 请求失败: ${this.getFastgptErrorMessage(error)}`);
    }
  }

  private unwrapFastgptResponse<T = any>(payload: any): T {
    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      Object.prototype.hasOwnProperty.call(payload, 'code')
    ) {
      return payload.data as T;
    }
    return payload as T;
  }

  private async loginFastgptRootUser() {
    const rootPassword = String(config.fastgptRootPassword || '').trim();
    if (!rootPassword) {
      throw new BadRequestException('未配置 FastGPT root 密码，无法管理 bundled FastGPT 模型');
    }

    try {
      const preLoginResponse = await axios.get(
        this.getFastgptEndpoint('/api/support/user/account/preLogin'),
        {
          timeout: 60000,
          params: {
            username: 'root',
          },
        },
      );
      const preLoginPayload = this.unwrapFastgptResponse<{ code?: string }>(preLoginResponse.data);
      const code = String(preLoginPayload?.code || '').trim();
      if (!code) {
        throw new BadRequestException('FastGPT root 预登录失败：未拿到验证码');
      }

      const loginResponse = await axios.post(
        this.getFastgptEndpoint('/api/support/user/account/loginByPassword'),
        {
          username: 'root',
          password: createHash('sha256').update(rootPassword).digest('hex'),
          code,
          language: 'zh-CN',
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const loginPayload = this.unwrapFastgptResponse<{ token?: string }>(loginResponse.data);
      const token = String(loginPayload?.token || '').trim();
      if (!token) {
        throw new BadRequestException('FastGPT root 登录失败：未返回 token');
      }
      return token;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`FastGPT root 登录失败: ${this.getFastgptErrorMessage(error)}`);
    }
  }

  private async requestFastgptAsRootUser(
    method: 'GET' | 'POST' | 'DELETE',
    pathname: string,
    rootToken: string,
    options: {
      body?: any;
      params?: Record<string, any>;
    } = {},
  ) {
    try {
      const response = await axios.request({
        method,
        url: this.getFastgptEndpoint(pathname),
        timeout: 60000,
        data: options.body,
        params: options.params,
        headers: {
          token: rootToken,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
      return this.unwrapFastgptResponse(response.data);
    } catch (error) {
      throw new BadRequestException(`FastGPT 管理请求失败: ${this.getFastgptErrorMessage(error)}`);
    }
  }

  private buildOpenAiCompatibleHeaders(requestAuth: string) {
    const normalizedToken = String(requestAuth || '').trim();
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {}),
    };
  }

  private async requestBundledModelEndpoint(
    requestUrl: string,
    requestAuth: string,
    body: Record<string, any>,
  ) {
    try {
      const response = await axios.post(requestUrl, body, {
        timeout: 60000,
        headers: this.buildOpenAiCompatibleHeaders(requestAuth),
      });
      return response.data;
    } catch (error) {
      throw new BadRequestException(`Bundled 模型请求失败: ${this.getFastgptErrorMessage(error)}`);
    }
  }

  private getFastgptErrorMessage(error: unknown) {
    const data = axios.isAxiosError(error) ? error.response?.data : (error as any)?.response?.data;
    const directMessage =
      typeof data === 'string'
        ? data
        : data?.message || data?.statusText || data?.error?.message || data?.error;
    if (typeof directMessage === 'string' && directMessage.trim()) {
      return directMessage;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return '未知错误';
  }

  private buildBundledLlmMetadata(aiQaConfig: AiQaConfig) {
    const llmConfig = aiQaConfig.bundledModels.llm;
    return {
      isCustom: true,
      isActive: true,
      provider: 'Other',
      type: 'llm' as const,
      model: llmConfig.model,
      name: llmConfig.name || llmConfig.model,
      requestUrl: llmConfig.requestUrl,
      requestAuth: llmConfig.requestAuth || undefined,
      maxContext: 32768,
      maxResponse: 4096,
      quoteMaxToken: 16000,
      maxTemperature: 1.2,
      charsPointsPrice: 0,
      censor: false,
      vision: false,
      reasoning: false,
      toolChoice: false,
      functionCall: false,
      defaultSystemChatPrompt: '',
      defaultConfig: {},
      fieldMap: {},
    };
  }

  private buildBundledEmbeddingMetadata(aiQaConfig: AiQaConfig) {
    const embeddingConfig = aiQaConfig.bundledModels.embedding;
    return {
      isCustom: true,
      isActive: true,
      provider: 'Other',
      type: 'embedding' as const,
      model: embeddingConfig.model,
      name: embeddingConfig.name || embeddingConfig.model,
      requestUrl: embeddingConfig.requestUrl,
      requestAuth: embeddingConfig.requestAuth || undefined,
      charsPointsPrice: 0,
      defaultToken: 512,
      maxToken: 3000,
      weight: 100,
    };
  }

  private extractEmbeddingVectorLength(payload: any) {
    if (Array.isArray(payload)) {
      if (payload.length && Array.isArray(payload[0])) {
        return payload[0].length;
      }
      if (payload.every((item) => typeof item === 'number')) {
        return payload.length;
      }
    }

    const embedding = payload?.data?.[0]?.embedding;
    if (Array.isArray(embedding)) {
      return embedding.length;
    }

    return 0;
  }

  private buildProvisionSelectedDataset(
    aiQaConfig: AiQaConfig,
    datasetId: string,
    datasetName: string,
  ) {
    return {
      datasetId,
      name: datasetName,
      avatar: '',
      vectorModel: {
        model: aiQaConfig.bundledModels.embedding.model,
        name: aiQaConfig.bundledModels.embedding.name || aiQaConfig.bundledModels.embedding.model,
      },
    };
  }

  private buildProvisionChatConfig() {
    return {
      welcomeText: '',
      variables: [],
      autoExecute: {
        open: false,
        defaultPrompt: '',
      },
      questionGuide: {
        open: false,
      },
      ttsConfig: {
        type: 'web',
      },
      whisperConfig: {
        open: false,
        autoSend: false,
        autoTTSResponse: false,
      },
      chatInputGuide: {
        open: false,
        customUrl: '',
      },
      fileSelectConfig: {
        maxFiles: 10,
        canSelectFile: false,
        canSelectImg: false,
        canSelectVideo: false,
        canSelectAudio: false,
        canSelectCustomFileExtension: false,
        customFileExtensionList: [],
      },
      instruction: '',
    };
  }

  private buildProvisionAppWorkflow(
    aiQaConfig: AiQaConfig,
    datasetId: string,
    datasetName: string,
  ) {
    const workflowStartNodeId = 'workflowStartNodeId';
    const systemConfigNodeId = 'userGuide';
    const datasetNodeId = 'iKBoX2vIzETU';
    const aiChatNodeId = '7BdojPlukIQw';
    const datasetSelection = this.buildProvisionSelectedDataset(aiQaConfig, datasetId, datasetName);

    return {
      nodes: [
        {
          nodeId: systemConfigNodeId,
          name: '系统配置',
          intro: '',
          avatar: 'core/workflow/template/systemConfig',
          flowNodeType: 'userGuide',
          position: {
            x: 531.2422736065552,
            y: -486.7611729549753,
          },
          inputs: [],
          outputs: [],
        },
        {
          nodeId: workflowStartNodeId,
          name: '流程开始',
          intro: '',
          avatar: 'core/workflow/template/workflowStart',
          flowNodeType: 'workflowStart',
          position: {
            x: 558.4082376415505,
            y: 123.72387429194112,
          },
          inputs: [
            {
              key: 'userChatInput',
              renderTypeList: ['reference', 'textarea'],
              valueType: 'string',
              label: 'workflow:user_question',
              toolDescription: 'user question',
              required: true,
            },
          ],
          outputs: [
            {
              id: 'userChatInput',
              key: 'userChatInput',
              label: 'common:core.module.input.label.user question',
              type: 'static',
              valueType: 'string',
            },
            {
              id: 'userFiles',
              key: 'userFiles',
              label: 'app:workflow.user_file_input',
              description: 'app:workflow.user_file_input_desc',
              type: 'static',
              valueType: 'arrayString',
            },
          ],
        },
        {
          nodeId: datasetNodeId,
          name: '知识库搜索',
          intro: 'app:dataset_search_tool_description',
          avatar: 'core/workflow/template/datasetSearch',
          flowNodeType: 'datasetSearchNode',
          showStatus: true,
          position: {
            x: 918.5901682164496,
            y: -227.11542247619582,
          },
          version: '4.9.2',
          inputs: [
            {
              key: 'datasets',
              renderTypeList: ['selectDataset', 'reference'],
              label: 'common:core.module.input.label.Select dataset',
              value: [datasetSelection],
              valueType: 'selectDataset',
              list: [],
              required: true,
            },
            {
              key: 'similarity',
              renderTypeList: ['selectDatasetParamsModal'],
              label: '',
              value: aiQaConfig.similarity,
              valueType: 'number',
            },
            {
              key: 'limit',
              renderTypeList: ['hidden'],
              label: '',
              value: aiQaConfig.limit,
              valueType: 'number',
            },
            {
              key: 'searchMode',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
              value: aiQaConfig.searchMode,
            },
            {
              key: 'embeddingWeight',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'number',
              value: 0.5,
            },
            {
              key: 'usingReRank',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'boolean',
              value: aiQaConfig.usingReRank,
            },
            {
              key: 'rerankModel',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
            },
            {
              key: 'rerankWeight',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'number',
              value: 0.5,
            },
            {
              key: 'datasetSearchUsingExtensionQuery',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'boolean',
              value: aiQaConfig.datasetSearchUsingExtensionQuery,
            },
            {
              key: 'datasetSearchExtensionModel',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
              value: aiQaConfig.datasetSearchExtensionModel || undefined,
            },
            {
              key: 'datasetSearchExtensionBg',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
              value: aiQaConfig.datasetSearchExtensionBg || '',
            },
            {
              key: 'userChatInput',
              renderTypeList: ['reference', 'textarea'],
              valueType: 'string',
              label: 'workflow:user_question',
              toolDescription: 'workflow:content_to_search',
              required: true,
              value: [workflowStartNodeId, 'userChatInput'],
            },
          ],
          outputs: [
            {
              id: 'quoteQA',
              key: 'quoteQA',
              label: 'common:core.module.Dataset quote.label',
              description: 'workflow:special_array_format',
              type: 'static',
              valueType: 'datasetQuote',
            },
            {
              id: 'system_error_text',
              key: 'system_error_text',
              type: 'error',
              valueType: 'string',
              label: 'workflow:error_text',
            },
          ],
        },
        {
          nodeId: aiChatNodeId,
          name: 'AI 对话',
          intro: 'workflow:template.ai_chat_intro',
          avatar: 'core/workflow/template/aiChat',
          flowNodeType: 'chatNode',
          showStatus: true,
          position: {
            x: 1106.3238387960757,
            y: -350.6030674683474,
          },
          version: '4.9.7',
          inputs: [
            {
              key: 'model',
              renderTypeList: ['settingLLMModel', 'reference'],
              label: 'common:core.module.input.label.aiModel',
              valueType: 'string',
              value: aiQaConfig.bundledModels.llm.model,
            },
            {
              key: 'temperature',
              renderTypeList: ['hidden'],
              label: '',
              value: 0,
              valueType: 'number',
              min: 0,
              max: 10,
              step: 1,
            },
            {
              key: 'maxToken',
              renderTypeList: ['hidden'],
              label: '',
              value: 2048,
              valueType: 'number',
              min: 100,
              max: 4000,
              step: 50,
            },
            {
              key: 'isResponseAnswerText',
              renderTypeList: ['hidden'],
              label: '',
              value: true,
              valueType: 'boolean',
            },
            {
              key: 'aiChatQuoteRole',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
              value: 'system',
            },
            {
              key: 'quoteTemplate',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
            },
            {
              key: 'quotePrompt',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
            },
            {
              key: 'systemPrompt',
              renderTypeList: ['textarea', 'reference'],
              maxLength: 100000,
              isRichText: true,
              valueType: 'string',
              label: 'common:core.ai.Prompt',
              description: 'core.app.tip.systemPromptTip',
              placeholder: 'core.app.tip.chatNodeSystemPromptTip',
              value: FASTGPT_APP_SYSTEM_PROMPT,
            },
            {
              key: 'history',
              renderTypeList: ['numberInput', 'reference'],
              valueType: 'chatHistory',
              label: 'common:core.module.input.label.chat history',
              description: 'workflow:max_dialog_rounds',
              required: true,
              min: 0,
              max: 50,
              value: 6,
            },
            {
              key: 'quoteQA',
              renderTypeList: ['settingDatasetQuotePrompt'],
              label: '',
              debugLabel: 'workflow:knowledge_base_reference',
              description: '',
              valueType: 'datasetQuote',
              value: [datasetNodeId, 'quoteQA'],
            },
            {
              key: 'fileUrlList',
              renderTypeList: ['reference', 'input'],
              label: 'app:workflow.user_file_input',
              debugLabel: 'app:workflow.user_file_input',
              description: 'app:workflow.user_file_input_desc',
              valueType: 'arrayString',
              value: [[workflowStartNodeId, 'userFiles']],
            },
            {
              key: 'userChatInput',
              renderTypeList: ['reference', 'textarea'],
              valueType: 'string',
              label: 'workflow:user_question',
              toolDescription: 'common:core.module.input.label.user question',
              required: true,
              value: [workflowStartNodeId, 'userChatInput'],
            },
            {
              key: 'aiChatVision',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'boolean',
              value: true,
            },
            {
              key: 'aiChatReasoning',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'boolean',
              value: false,
            },
            {
              key: 'aiChatTopP',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'number',
            },
            {
              key: 'aiChatStopSign',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
            },
            {
              key: 'aiChatResponseFormat',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
            },
            {
              key: 'aiChatJsonSchema',
              renderTypeList: ['hidden'],
              label: '',
              valueType: 'string',
            },
          ],
          outputs: [
            {
              id: 'history',
              key: 'history',
              required: true,
              label: 'common:core.module.output.label.New context',
              description: 'common:core.module.output.description.New context',
              valueType: 'chatHistory',
              type: 'static',
            },
            {
              id: 'answerText',
              key: 'answerText',
              required: true,
              label: 'common:core.module.output.label.Ai response content',
              description: 'common:core.module.output.description.Ai response content',
              valueType: 'string',
              type: 'static',
            },
            {
              id: 'reasoningText',
              key: 'reasoningText',
              required: false,
              label: 'workflow:reasoning_content',
              valueType: 'string',
              type: 'static',
            },
            {
              id: 'system_error_text',
              key: 'system_error_text',
              type: 'error',
              valueType: 'string',
              label: 'workflow:error_text',
            },
          ],
        },
      ],
      edges: [
        {
          source: workflowStartNodeId,
          target: datasetNodeId,
          sourceHandle: `${workflowStartNodeId}-source-right`,
          targetHandle: `${datasetNodeId}-target-left`,
        },
        {
          source: datasetNodeId,
          target: aiChatNodeId,
          sourceHandle: `${datasetNodeId}-source-right`,
          targetHandle: `${aiChatNodeId}-target-left`,
        },
      ],
      chatConfig: this.buildProvisionChatConfig(),
    };
  }

  private async getFastgptDatasetDetail(rootToken: string, datasetId: string) {
    return await this.requestFastgptAsRootUser('GET', '/api/core/dataset/detail', rootToken, {
      params: {
        id: datasetId,
      },
    });
  }

  private async getFastgptAppDetail(rootToken: string, appId: string) {
    return await this.requestFastgptAsRootUser('GET', '/api/core/app/detail', rootToken, {
      params: {
        appId,
      },
    });
  }

  private async updateFastgptDataset(
    rootToken: string,
    datasetId: string,
    aiQaConfig: AiQaConfig,
    datasetName: string,
  ) {
    await this.requestFastgptAsRootUser('POST', '/api/core/dataset/update', rootToken, {
      body: {
        id: datasetId,
        name: datasetName,
        intro: FASTGPT_DATASET_INTRO,
        agentModel: aiQaConfig.bundledModels.llm.model,
      },
    });
    return {
      id: datasetId,
      name: datasetName,
      action: 'updated' as const,
    };
  }

  private async createFastgptDataset(
    rootToken: string,
    aiQaConfig: AiQaConfig,
    datasetName: string,
  ) {
    const datasetId = await this.requestFastgptAsRootUser(
      'POST',
      '/api/core/dataset/create',
      rootToken,
      {
        body: {
          name: datasetName,
          intro: FASTGPT_DATASET_INTRO,
          type: 'dataset',
          avatar: '',
          vectorModel: aiQaConfig.bundledModels.embedding.model,
          agentModel: aiQaConfig.bundledModels.llm.model,
        },
      },
    );
    const resolvedDatasetId = String(datasetId || '').trim();
    if (!resolvedDatasetId) {
      throw new BadRequestException('FastGPT 未返回 Dataset ID，无法完成自动初始化');
    }
    return {
      id: resolvedDatasetId,
      name: datasetName,
      action: 'created' as const,
    };
  }

  private async ensureManagedV2FastgptDataset(
    rootToken: string,
    aiQaConfig: AiQaConfig,
    managedResourceNames: AiQaManagedResourceNames,
  ) {
    const currentDatasetId =
      aiQaConfig.resourceManagementMode === 'managedV2'
        ? String(aiQaConfig.datasetId || '').trim()
        : '';
    if (currentDatasetId) {
      try {
        const detail = await this.getFastgptDatasetDetail(rootToken, currentDatasetId);
        const vectorModel = String(detail?.vectorModel?.model || detail?.vectorModel || '').trim();
        if (vectorModel && vectorModel !== aiQaConfig.bundledModels.embedding.model) {
          this.logger.warn(
            `AI 问答 Dataset ${currentDatasetId} 的 embedding 模型为 ${vectorModel}，当前配置为 ${aiQaConfig.bundledModels.embedding.model}，将改为新建 Dataset。`,
          );
        } else {
          const currentName = String(detail?.name || '').trim();
          const currentIntro = String(detail?.intro || '').trim();
          const currentAgentModel = String(
            detail?.agentModel?.model || detail?.agentModel || '',
          ).trim();
          if (
            currentName !== managedResourceNames.dataset ||
            currentIntro !== FASTGPT_DATASET_INTRO ||
            (aiQaConfig.bundledModels.llm.model &&
              currentAgentModel &&
              currentAgentModel !== aiQaConfig.bundledModels.llm.model)
          ) {
            return await this.updateFastgptDataset(
              rootToken,
              currentDatasetId,
              aiQaConfig,
              managedResourceNames.dataset,
            );
          }
          return {
            id: currentDatasetId,
            name: String(detail?.name || managedResourceNames.dataset),
            action: 'reused' as const,
          };
        }
      } catch (error) {
        this.logger.warn(
          `读取当前 AI 问答 Dataset 失败，将自动创建新 Dataset: ${this.getFastgptErrorMessage(
            error,
          )}`,
        );
      }
    }

    return await this.createFastgptDataset(rootToken, aiQaConfig, managedResourceNames.dataset);
  }

  private async ensureManagedV2FastgptApp(
    rootToken: string,
    aiQaConfig: AiQaConfig,
    dataset: { id: string; name: string },
    managedResourceNames: AiQaManagedResourceNames,
  ) {
    const workflow = this.buildProvisionAppWorkflow(aiQaConfig, dataset.id, dataset.name);
    const currentAppId =
      aiQaConfig.resourceManagementMode === 'managedV2'
        ? String(aiQaConfig.appId || '').trim()
        : '';

    if (currentAppId) {
      try {
        await this.requestFastgptAsRootUser('POST', '/api/core/app/update', rootToken, {
          params: {
            appId: currentAppId,
          },
          body: {
            name: managedResourceNames.app,
            intro: FASTGPT_APP_INTRO,
            nodes: workflow.nodes,
            edges: workflow.edges,
            chatConfig: workflow.chatConfig,
          },
        });

        return {
          id: currentAppId,
          name: managedResourceNames.app,
          action: 'updated' as const,
        };
      } catch (error) {
        this.logger.warn(
          `更新当前 AI 问答 App 失败，将自动创建新 App: ${this.getFastgptErrorMessage(error)}`,
        );
      }
    }

    const appId = await this.requestFastgptAsRootUser('POST', '/api/core/app/create', rootToken, {
      body: {
        name: managedResourceNames.app,
        intro: FASTGPT_APP_INTRO,
        type: 'simple',
        modules: workflow.nodes,
        edges: workflow.edges,
        chatConfig: workflow.chatConfig,
      },
    });
    const resolvedAppId = String(appId || '').trim();
    if (!resolvedAppId) {
      throw new BadRequestException('FastGPT 未返回 App ID，无法完成自动初始化');
    }

    return {
      id: resolvedAppId,
      name: managedResourceNames.app,
      action: 'created' as const,
    };
  }

  private async ensureManagedV2FastgptAppApiKey(
    rootToken: string,
    aiQaConfig: AiQaConfig,
    app: { id: string; action: 'created' | 'updated' },
    managedResourceNames: AiQaManagedResourceNames,
  ) {
    const currentApiKey = String(aiQaConfig.apiKey || '').trim();
    const currentAppId = String(aiQaConfig.appId || '').trim();
    if (
      aiQaConfig.resourceManagementMode === 'managedV2' &&
      currentApiKey &&
      currentAppId &&
      currentAppId === app.id &&
      app.action === 'updated'
    ) {
      return {
        apiKey: currentApiKey,
        action: 'reused' as const,
      };
    }

    const apiKey = await this.requestFastgptAsRootUser(
      'POST',
      '/api/support/openapi/create',
      rootToken,
      {
        body: {
          appId: app.id,
          name: managedResourceNames.apiKey,
          limit: {
            maxUsagePoints: -1,
          },
        },
      },
    );
    const resolvedApiKey = String(apiKey || '').trim();
    if (!resolvedApiKey) {
      throw new BadRequestException('FastGPT 未返回 API Key，无法完成自动初始化');
    }

    return {
      apiKey: resolvedApiKey,
      action: 'created' as const,
    };
  }

  private async deleteFastgptDataset(rootToken: string, datasetId: string) {
    await this.requestFastgptAsRootUser('DELETE', '/api/core/dataset/delete', rootToken, {
      params: {
        id: datasetId,
      },
    });
  }

  private async deleteFastgptApp(rootToken: string, appId: string) {
    await this.requestFastgptAsRootUser('DELETE', '/api/core/app/del', rootToken, {
      params: {
        appId,
      },
    });
  }

  private shouldInspectLegacyAutoResources(aiQaConfig: AiQaConfig) {
    return (
      !aiQaConfig.resourceManagementMode &&
      Boolean(aiQaConfig.datasetId && aiQaConfig.appId && aiQaConfig.apiKey)
    );
  }

  private findWorkflowNode(modules: any[], nodeId: string) {
    return modules.find((item) => String(item?.nodeId || '').trim() === nodeId);
  }

  private findWorkflowInputValue(node: any, key: string) {
    const inputs = Array.isArray(node?.inputs) ? node.inputs : [];
    const input = inputs.find((item) => String(item?.key || '').trim() === key);
    return input?.value;
  }

  private isLegacyFastgptDatasetDetail(detail: any) {
    return (
      String(detail?.name || '').trim() === FASTGPT_DATASET_NAME &&
      String(detail?.intro || '').trim() === FASTGPT_DATASET_INTRO
    );
  }

  private isLegacyFastgptAppDetail(detail: any, datasetId: string) {
    if (
      String(detail?.name || '').trim() !== FASTGPT_APP_NAME ||
      String(detail?.intro || '').trim() !== FASTGPT_APP_INTRO
    ) {
      return false;
    }

    const modules = Array.isArray(detail?.modules) ? detail.modules : [];
    const workflowStartNode = this.findWorkflowNode(modules, 'workflowStartNodeId');
    const datasetNode = this.findWorkflowNode(modules, 'iKBoX2vIzETU');
    const aiChatNode = this.findWorkflowNode(modules, '7BdojPlukIQw');
    if (!workflowStartNode || !datasetNode || !aiChatNode) {
      return false;
    }

    const selectedDatasets = this.findWorkflowInputValue(datasetNode, 'datasets');
    const datasetMatches = Array.isArray(selectedDatasets)
      ? selectedDatasets.some(
          (item) =>
            String(item?.datasetId || '').trim() === datasetId &&
            String(item?.name || '').trim() === FASTGPT_DATASET_NAME,
        )
      : false;
    if (!datasetMatches) {
      return false;
    }

    const systemPrompt = String(
      this.findWorkflowInputValue(aiChatNode, 'systemPrompt') || '',
    ).trim();
    if (systemPrompt !== FASTGPT_APP_SYSTEM_PROMPT) {
      return false;
    }

    const edges = Array.isArray(detail?.edges) ? detail.edges : [];
    return (
      edges.some(
        (item) =>
          String(item?.source || '').trim() === 'workflowStartNodeId' &&
          String(item?.target || '').trim() === 'iKBoX2vIzETU',
      ) &&
      edges.some(
        (item) =>
          String(item?.source || '').trim() === 'iKBoX2vIzETU' &&
          String(item?.target || '').trim() === '7BdojPlukIQw',
      )
    );
  }

  private async isLegacyAutoManagedResourceSet(aiQaConfig: AiQaConfig, rootToken: string) {
    try {
      const [datasetDetail, appDetail] = await Promise.all([
        this.getFastgptDatasetDetail(rootToken, aiQaConfig.datasetId),
        this.getFastgptAppDetail(rootToken, aiQaConfig.appId),
      ]);
      return (
        this.isLegacyFastgptDatasetDetail(datasetDetail) &&
        this.isLegacyFastgptAppDetail(appDetail, aiQaConfig.datasetId)
      );
    } catch (error) {
      this.logger.warn(
        `检测旧版 AI 问答自动资源失败，已保留当前状态: ${this.getFastgptErrorMessage(error)}`,
      );
      return false;
    }
  }

  private async refreshLegacyMigrationPending(aiQaConfig: AiQaConfig) {
    if (
      !this.shouldInspectLegacyAutoResources(aiQaConfig) ||
      !this.hasFastgptRootPasswordConfigured()
    ) {
      return aiQaConfig;
    }

    try {
      const rootToken = await this.loginFastgptRootUser();
      const legacyAutoMigrationPending = await this.isLegacyAutoManagedResourceSet(
        aiQaConfig,
        rootToken,
      );
      if (legacyAutoMigrationPending === aiQaConfig.legacyAutoMigrationPending) {
        return aiQaConfig;
      }

      const nextConfig = this.normalizeConfig({
        ...aiQaConfig,
        legacyAutoMigrationPending,
      });
      await this.persistConfig(nextConfig);
      return nextConfig;
    } catch (error) {
      this.logger.warn(
        `刷新旧版 AI 问答资源迁移状态失败，已保留当前配置: ${this.getFastgptErrorMessage(error)}`,
      );
      return aiQaConfig;
    }
  }

  private buildSourceKey(sourceType: AiQaSourceType, sourceId: string) {
    return `${sourceType}:${sourceId}`;
  }

  private buildSourceHash(source: AiQaKnowledgeSource) {
    const payload = JSON.stringify({
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      title: source.title,
      content: source.content,
      updatedAt: source.updatedAt,
      publicUrl: source.publicUrl || '',
      editorUrl: source.editorUrl,
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  private normalizeComparableTimestamp(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }

  private isKnowledgeMappingCurrent(
    mapping: AiKnowledgeSyncRecord | null | undefined,
    source: AiQaKnowledgeSource,
    datasetId: string,
  ) {
    if (!mapping?.collectionId || mapping.datasetId !== datasetId || mapping.deletedAt) {
      return false;
    }

    if (mapping.contentHash === this.buildSourceHash(source)) {
      return true;
    }

    // Legacy mappings may still carry hashes generated before editor URL normalization.
    // Treat matching title + update time as current, then refresh the stored hash on the next sync.
    return (
      mapping.sourceType === source.sourceType &&
      String(mapping.sourceId || '') === String(source.sourceId || '') &&
      String(mapping.title || '') === String(source.title || '') &&
      this.normalizeComparableTimestamp(mapping.updatedAt) ===
        this.normalizeComparableTimestamp(source.updatedAt)
    );
  }

  private getSourceTypeLabel(sourceType: AiQaSourceType) {
    switch (sourceType) {
      case 'article':
        return '文章';
      case 'draft':
        return '草稿';
      case 'document':
        return '私密文档';
      default:
        return sourceType;
    }
  }

  private buildCollectionName(source: AiQaKnowledgeSource) {
    const title =
      source.title || `${this.getSourceTypeLabel(source.sourceType)} ${source.sourceId}`;
    return `[VanBlog][${this.getSourceTypeLabel(source.sourceType)}] ${title}`.slice(0, 180);
  }

  private buildKnowledgeText(source: AiQaKnowledgeSource) {
    const lines = [
      `# ${source.title || `${this.getSourceTypeLabel(source.sourceType)} ${source.sourceId}`}`,
      `类型: ${this.getSourceTypeLabel(source.sourceType)}`,
      `来源 ID: ${source.sourceId}`,
      `更新时间: ${source.updatedAt}`,
      `编辑入口: ${source.editorUrl}`,
    ];

    if (source.publicUrl) {
      lines.push(`公开访问: ${source.publicUrl}`);
    }

    lines.push('', source.content || '(空内容)');
    return lines.join('\n');
  }

  private async getArticleCategoryPrivateMap(articles: any[]): Promise<Map<string, boolean>> {
    const categoryNames = [
      ...new Set((articles || []).map((article) => article?.category).filter(Boolean)),
    ];
    const categories = await this.structuredDataService.getCategoriesByNames(categoryNames);
    return new Map<string, boolean>(
      categories.map((category: any) => [String(category.name), Boolean(category?.private)]),
    );
  }

  private buildArticleSource(article: any, categoryPrivateMap: Map<string, boolean>) {
    if (!article?.id || article?.deleted) {
      return null;
    }
    const isCategoryPrivate = Boolean(categoryPrivateMap.get(article.category || ''));
    const isPublic = !article.hidden && !article.private && !isCategoryPrivate;

    return {
      sourceType: 'article',
      sourceId: String(article.id),
      title: article.title || `文章 ${article.id}`,
      content: article.content || '',
      updatedAt: new Date(article.updatedAt || article.createdAt || Date.now()).toISOString(),
      publicUrl: isPublic ? `/post/${article.pathname || article.id}` : undefined,
      editorUrl: this.normalizeAdminEditorUrl(`/editor?type=article&id=${article.id}`),
    } as AiQaKnowledgeSource;
  }

  private buildDraftSource(draft: any) {
    if (!draft?.id || draft?.deleted) {
      return null;
    }
    return {
      sourceType: 'draft',
      sourceId: String(draft.id),
      title: draft.title || `草稿 ${draft.id}`,
      content: draft.content || '',
      updatedAt: new Date(draft.updatedAt || draft.createdAt || Date.now()).toISOString(),
      editorUrl: this.normalizeAdminEditorUrl(`/editor?type=draft&id=${draft.id}`),
    } as AiQaKnowledgeSource;
  }

  private buildDocumentSource(document: any) {
    if (!document?.id || document?.deleted) {
      return null;
    }
    if (document.type === 'library' && !String(document.content || '').trim()) {
      return null;
    }
    return {
      sourceType: 'document',
      sourceId: String(document.id),
      title: document.title || `文档 ${document.id}`,
      content: document.content || '',
      updatedAt: new Date(document.updatedAt || document.createdAt || Date.now()).toISOString(),
      editorUrl: this.normalizeAdminEditorUrl(`/editor?type=document&id=${document.id}`),
    } as AiQaKnowledgeSource;
  }

  private async collectKnowledgeSources() {
    const [articles, drafts, documents] = (await Promise.all([
      this.articleProvider.getAll('admin', true, false),
      this.draftProvider.getAll(),
      this.structuredDataService.listDocuments({ includeDelete: false, includeContent: true }),
    ])) as [any[], any[], any[]];
    const categoryPrivateMap: Map<string, boolean> =
      await this.getArticleCategoryPrivateMap(articles);

    return [
      ...(articles || [])
        .map((article) => this.buildArticleSource(article, categoryPrivateMap))
        .filter(Boolean),
      ...(drafts || []).map((draft) => this.buildDraftSource(draft)).filter(Boolean),
      ...(documents || []).map((document) => this.buildDocumentSource(document)).filter(Boolean),
    ] as AiQaKnowledgeSource[];
  }

  private async getKnowledgeSourceById(sourceType: AiQaSourceType, sourceId: string) {
    switch (sourceType) {
      case 'article': {
        const article = await this.articleProvider.getById(Number(sourceId), 'admin');
        if (!article) {
          return null;
        }
        const category = article.category
          ? await this.structuredDataService.getCategoryByName(article.category)
          : null;
        return this.buildArticleSource(
          article,
          new Map([[article.category || '', Boolean(category?.private)]]),
        );
      }
      case 'draft': {
        const draft = await this.draftProvider.findById(Number(sourceId));
        return draft ? this.buildDraftSource(draft) : null;
      }
      case 'document': {
        const document = await this.documentProvider.findById(Number(sourceId));
        return document ? this.buildDocumentSource(document) : null;
      }
      default:
        return null;
    }
  }

  private async createTextCollection(aiQaConfig: AiQaConfig, source: AiQaKnowledgeSource) {
    const payload = await this.postFastgpt(
      '/api/core/dataset/collection/create/text',
      {
        text: this.buildKnowledgeText(source),
        datasetId: aiQaConfig.datasetId,
        parentId: null,
        name: this.buildCollectionName(source),
        trainingType: 'chunk',
        chunkSettingMode: 'auto',
        qaPrompt: '',
        metadata: {
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          editorUrl: source.editorUrl,
          publicUrl: source.publicUrl || '',
          title: source.title,
          blogInstanceId: aiQaConfig.blogInstanceId,
          resourceNamingVersion: AI_QA_RESOURCE_NAMING_VERSION,
          managedBy: 'vanblog',
        },
      },
      this.getDatasetAuthorization(aiQaConfig),
    );

    const collectionId = payload?.data?.collectionId || payload?.data?.id || payload?.collectionId;
    if (!collectionId) {
      throw new BadRequestException('FastGPT 未返回 collectionId，无法完成知识同步');
    }
    return String(collectionId);
  }

  private async deleteCollectionIds(aiQaConfig: AiQaConfig, collectionIds: string[]) {
    const normalizedIds = [
      ...new Set((collectionIds || []).map((item) => String(item || '').trim()).filter(Boolean)),
    ];
    if (!normalizedIds.length) {
      return;
    }

    try {
      await this.postFastgpt(
        '/api/core/dataset/collection/delete',
        { collectionIds: normalizedIds },
        this.getDatasetAuthorization(aiQaConfig),
      );
    } catch (error) {
      this.logger.warn(`删除 FastGPT collection 失败，已继续后续流程: ${(error as Error).message}`);
    }
  }

  private async upsertSourceMapping(
    aiQaConfig: AiQaConfig,
    source: AiQaKnowledgeSource,
    collectionId: string,
  ) {
    const now = new Date().toISOString();
    const record: AiKnowledgeSyncRecord = {
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      contentHash: this.buildSourceHash(source),
      datasetId: aiQaConfig.datasetId,
      collectionId,
      title: source.title,
      publicUrl: source.publicUrl,
      editorUrl: source.editorUrl,
      updatedAt: source.updatedAt,
      lastSyncedAt: now,
      deletedAt: null,
    };
    await this.structuredDataService.upsertAiKnowledgeSync(record);
  }

  private async syncOneSource(aiQaConfig: AiQaConfig, source: AiQaKnowledgeSource) {
    const existing = await this.structuredDataService.getAiKnowledgeSync(
      source.sourceType,
      source.sourceId,
      true,
    );
    const contentHash = this.buildSourceHash(source);

    if (
      this.isKnowledgeMappingCurrent(
        existing as AiKnowledgeSyncRecord | null,
        source,
        aiQaConfig.datasetId,
      )
    ) {
      await this.structuredDataService.upsertAiKnowledgeSync({
        ...(existing as AiKnowledgeSyncRecord),
        contentHash,
        title: source.title,
        publicUrl: source.publicUrl,
        editorUrl: source.editorUrl,
        updatedAt: source.updatedAt,
        lastSyncedAt: new Date().toISOString(),
        deletedAt: null,
      });
      return 'skipped' as const;
    }

    if (existing?.collectionId) {
      await this.deleteCollectionIds(aiQaConfig, [existing.collectionId]);
    }

    const collectionId = await this.createTextCollection(aiQaConfig, source);
    await this.upsertSourceMapping(aiQaConfig, source, collectionId);
    return existing?.collectionId ? ('updated' as const) : ('created' as const);
  }

  private async removeSourceByKey(
    aiQaConfig: AiQaConfig,
    sourceType: AiQaSourceType,
    sourceId: string,
  ) {
    const existing = await this.structuredDataService.getAiKnowledgeSync(
      sourceType,
      sourceId,
      true,
    );
    if (!existing) {
      return false;
    }

    if (existing.collectionId) {
      await this.deleteCollectionIds(aiQaConfig, [existing.collectionId]);
    }
    await this.structuredDataService.markAiKnowledgeSyncDeleted(sourceType, sourceId);
    return true;
  }

  private async writeRuntimePatch(patch: Partial<AiQaConfig['runtime']>) {
    const currentConfig = await this.readConfig();
    const nextConfig = this.normalizeConfig({
      ...currentConfig,
      runtime: {
        ...(currentConfig.runtime || {}),
        ...(patch || {}),
      },
    });
    await this.persistConfig(nextConfig);
    return nextConfig;
  }

  private async markSyncFailure(trigger: string, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await this.writeRuntimePatch({
      lastSyncAt: new Date().toISOString(),
      lastSyncError: `${trigger}: ${errorMessage}`,
    });
  }

  private async searchDataset(aiQaConfig: AiQaConfig, text: string) {
    const payload = await this.postFastgpt(
      '/api/core/dataset/searchTest',
      {
        datasetId: aiQaConfig.datasetId,
        text,
        limit: aiQaConfig.limit,
        similarity: aiQaConfig.similarity,
        searchMode: aiQaConfig.searchMode,
        usingReRank: aiQaConfig.usingReRank,
        datasetSearchUsingExtensionQuery: aiQaConfig.datasetSearchUsingExtensionQuery,
        datasetSearchExtensionModel: aiQaConfig.datasetSearchExtensionModel || undefined,
        datasetSearchExtensionBg: aiQaConfig.datasetSearchExtensionBg || undefined,
      },
      this.getDatasetAuthorization(aiQaConfig),
    );
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  private extractChatAnswer(payload: any) {
    const directAnswer =
      payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.message?.reasoning_content;
    if (typeof directAnswer === 'string' && directAnswer.trim()) {
      return directAnswer.trim();
    }

    const responseData = Array.isArray(payload?.responseData) ? payload.responseData : [];
    const fallback = [...responseData]
      .reverse()
      .map((item) => item?.answer)
      .find((item) => typeof item === 'string' && item.trim());
    return typeof fallback === 'string' ? fallback.trim() : '';
  }

  private extractScore(rawScore: any) {
    if (typeof rawScore === 'number') {
      return rawScore;
    }
    if (Array.isArray(rawScore)) {
      const values = rawScore
        .map((item) => Number(item?.value))
        .filter((item) => Number.isFinite(item));
      if (values.length) {
        return Math.max(...values);
      }
    }
    return undefined;
  }

  private extractQuoteList(payload: any) {
    const responseData = Array.isArray(payload?.responseData) ? payload.responseData : [];
    const choiceQuotes = Array.isArray(payload?.choices)
      ? payload.choices.flatMap((choice: any) => choice?.message?.totalQuoteList || [])
      : [];

    const allQuotes = [
      ...responseData.flatMap((item: any) => item?.quoteList || []),
      ...responseData.flatMap((item: any) => item?.totalQuoteList || []),
      ...choiceQuotes,
    ];

    const deduped = new Map<string, any>();
    for (const quote of allQuotes) {
      const key = [
        quote?.collectionId || quote?.collection_id || '',
        quote?.id || '',
        quote?.q || '',
        quote?.a || '',
      ].join('::');
      deduped.set(key, quote);
    }
    return Array.from(deduped.values());
  }

  private async enrichCitations(quotes: any[]): Promise<AiQaCitation[]> {
    const collectionIds = [
      ...new Set(
        quotes.map((quote) => quote?.collectionId || quote?.collection_id).filter(Boolean),
      ),
    ];
    const mappings = (await this.structuredDataService.listAiKnowledgeSyncsByCollectionIds(
      collectionIds,
    )) as AiKnowledgeSyncRecord[];
    const mappingMap = new Map<string, AiKnowledgeSyncRecord>(
      mappings.map((item) => [item.collectionId, item]),
    );

    return quotes.map((quote) => {
      const collectionId = String(quote?.collectionId || quote?.collection_id || '');
      const mapping = mappingMap.get(collectionId);
      return {
        collectionId: collectionId || undefined,
        sourceType: mapping?.sourceType,
        sourceId: mapping?.sourceId,
        title: mapping?.title || quote?.sourceName || '未命名知识片段',
        score: this.extractScore(quote?.score),
        question: quote?.q || undefined,
        answer: quote?.a || undefined,
        sourceName: quote?.sourceName || undefined,
        editorUrl: this.normalizeAdminEditorUrl(mapping?.editorUrl || ''),
        publicUrl: mapping?.publicUrl,
      };
    });
  }

  private normalizeConversationActor(actor?: AiQaConversationActor | null): AiQaConversationActor {
    const userId = Number(actor?.userId);
    return {
      userId: Number.isFinite(userId) && userId >= 0 ? userId : undefined,
      name: String(actor?.name || '').trim() || undefined,
      nickname: String(actor?.nickname || '').trim() || undefined,
    };
  }

  private normalizeConversationTitle(title: string, fallback = '未命名会话') {
    const normalized = String(title || '')
      .replace(/\s+/g, ' ')
      .trim();
    const sliced = normalized.slice(0, 40).trim();
    return sliced || fallback;
  }

  private buildConversationTitle(question: string) {
    return this.normalizeConversationTitle(question, '新会话');
  }

  private buildConversationPreview(content: string, limit = 120) {
    const normalized = String(content || '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized.slice(0, limit);
  }

  private toConversationSummary(
    conversation: AiQaConversationRecord | null | undefined,
  ): AiQaConversationSummary | null {
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
      messageCount: Number(conversation.messageCount || 0),
      lastMessagePreview: conversation.lastMessagePreview || '',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private async getConversationOrThrow(conversationId: string) {
    const normalizedId = String(conversationId || '').trim();
    if (!normalizedId) {
      throw new BadRequestException('会话不存在');
    }
    const conversation = await this.structuredDataService.getAiQaConversation(normalizedId);
    if (!conversation) {
      throw new BadRequestException('会话不存在或已删除');
    }
    return conversation as AiQaConversationRecord;
  }

  private async resolveConversationForChat(
    conversationId?: string,
    legacyChatId?: string,
  ): Promise<{ conversation: AiQaConversationRecord | null; chatId: string }> {
    const normalizedConversationId = String(conversationId || '').trim();
    if (normalizedConversationId) {
      const conversation = await this.getConversationOrThrow(normalizedConversationId);
      return {
        conversation,
        chatId: conversation.chatId,
      };
    }

    const normalizedChatId = String(legacyChatId || '').trim();
    if (normalizedChatId) {
      const existing =
        await this.structuredDataService.getAiQaConversationByChatId(normalizedChatId);
      return {
        conversation: (existing as AiQaConversationRecord | null) || null,
        chatId: normalizedChatId,
      };
    }

    return {
      conversation: null,
      chatId: `vanblog-admin-${randomUUID()}`,
    };
  }

  private buildConversationMessageRecord(params: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    grounded?: boolean;
    citations?: AiQaCitation[];
    createdAt: string;
    actor?: AiQaConversationActor;
  }): AiQaMessageRecord {
    const actor = this.normalizeConversationActor(params.actor);
    return {
      id: randomUUID(),
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      grounded: Boolean(params.grounded),
      citations: params.citations || [],
      createdAt: params.createdAt,
      createdByUserId: params.role === 'user' ? actor.userId : undefined,
      createdByName: params.role === 'user' ? actor.name : undefined,
      createdByNickname: params.role === 'user' ? actor.nickname : undefined,
    };
  }

  private async persistChatTurn(params: {
    conversation: AiQaConversationRecord | null;
    chatId: string;
    question: string;
    answer: string;
    grounded: boolean;
    citations: AiQaCitation[];
    actor?: AiQaConversationActor;
  }): Promise<{
    conversation: AiQaConversationSummary;
    userMessage: AiQaConversationMessage;
    assistantMessage: AiQaConversationMessage;
  }> {
    const actor = this.normalizeConversationActor(params.actor);
    const question = String(params.question || '').trim();
    const answer = String(params.answer || '').trim();
    const baseTime = new Date();
    const userCreatedAt = baseTime.toISOString();
    const assistantCreatedAt = new Date(baseTime.getTime() + 1).toISOString();
    let conversation =
      params.conversation ||
      ({
        id: randomUUID(),
        chatId: params.chatId,
        title: this.buildConversationTitle(question),
        createdByUserId: actor.userId,
        createdByName: actor.name,
        createdByNickname: actor.nickname,
        messageCount: 0,
        lastMessagePreview: '',
        createdAt: userCreatedAt,
        updatedAt: userCreatedAt,
        deletedAt: null,
      } as AiQaConversationRecord);
    const createdConversation = !params.conversation;
    const userMessage = this.buildConversationMessageRecord({
      conversationId: conversation.id,
      role: 'user',
      content: question,
      grounded: false,
      citations: [],
      createdAt: userCreatedAt,
      actor,
    });
    const assistantMessage = this.buildConversationMessageRecord({
      conversationId: conversation.id,
      role: 'assistant',
      content: answer,
      grounded: params.grounded,
      citations: params.citations,
      createdAt: assistantCreatedAt,
      actor,
    });

    try {
      if (createdConversation) {
        await this.structuredDataService.createAiQaConversation(conversation);
      }
      await this.structuredDataService.createAiQaMessages([userMessage, assistantMessage]);
      conversation = ((await this.structuredDataService.updateAiQaConversation(conversation.id, {
        messageCount: Number(conversation.messageCount || 0) + 2,
        lastMessagePreview: this.buildConversationPreview(answer),
        updatedAt: assistantCreatedAt,
      })) as AiQaConversationRecord | null) || {
        ...conversation,
        messageCount: Number(conversation.messageCount || 0) + 2,
        lastMessagePreview: this.buildConversationPreview(answer),
        updatedAt: assistantCreatedAt,
      };
    } catch (error) {
      if (createdConversation) {
        await this.structuredDataService.updateAiQaConversation(conversation.id, {
          deletedAt: assistantCreatedAt,
          updatedAt: assistantCreatedAt,
        });
      }
      throw error;
    }

    return {
      conversation: this.toConversationSummary(conversation) as AiQaConversationSummary,
      userMessage,
      assistantMessage,
    };
  }

  async getConfig() {
    const aiQaConfig = await this.ensureBlogInstanceId(await this.readConfig());
    return this.buildConfigView(aiQaConfig);
  }

  async updateConfig(patch: Partial<AiQaConfig>) {
    const currentConfig = await this.readConfig();
    const nextApiKey =
      patch?.apiKey === undefined || patch?.apiKey === SECRET_MASK
        ? currentConfig.apiKey
        : String(patch?.apiKey || '').trim();
    const nextBundledModels = {
      llm: {
        ...currentConfig.bundledModels.llm,
        ...(patch?.bundledModels?.llm || {}),
        requestAuth:
          patch?.bundledModels?.llm?.requestAuth === undefined ||
          patch?.bundledModels?.llm?.requestAuth === SECRET_MASK
            ? currentConfig.bundledModels.llm.requestAuth
            : String(patch?.bundledModels?.llm?.requestAuth || '').trim(),
      },
      embedding: {
        ...currentConfig.bundledModels.embedding,
        ...(patch?.bundledModels?.embedding || {}),
        requestAuth:
          patch?.bundledModels?.embedding?.requestAuth === undefined ||
          patch?.bundledModels?.embedding?.requestAuth === SECRET_MASK
            ? currentConfig.bundledModels.embedding.requestAuth
            : String(patch?.bundledModels?.embedding?.requestAuth || '').trim(),
      },
    };

    const datasetIdProvided = Object.prototype.hasOwnProperty.call(patch || {}, 'datasetId');
    const appIdProvided = Object.prototype.hasOwnProperty.call(patch || {}, 'appId');
    const apiKeyProvided = Object.prototype.hasOwnProperty.call(patch || {}, 'apiKey');

    const nextConfig = this.normalizeConfig({
      ...currentConfig,
      enabled: patch?.enabled ?? currentConfig.enabled,
      datasetId: patch?.datasetId ?? currentConfig.datasetId,
      appId: patch?.appId ?? currentConfig.appId,
      apiKey: nextApiKey,
      searchMode: patch?.searchMode ?? currentConfig.searchMode,
      limit: patch?.limit ?? currentConfig.limit,
      similarity: patch?.similarity ?? currentConfig.similarity,
      usingReRank: patch?.usingReRank ?? currentConfig.usingReRank,
      datasetSearchUsingExtensionQuery:
        patch?.datasetSearchUsingExtensionQuery ?? currentConfig.datasetSearchUsingExtensionQuery,
      datasetSearchExtensionModel:
        patch?.datasetSearchExtensionModel ?? currentConfig.datasetSearchExtensionModel,
      datasetSearchExtensionBg:
        patch?.datasetSearchExtensionBg ?? currentConfig.datasetSearchExtensionBg,
      bundledModels: nextBundledModels,
      runtime: currentConfig.runtime,
      blogInstanceId: currentConfig.blogInstanceId,
      resourceManagementMode: currentConfig.resourceManagementMode,
      resourceNamingVersion: currentConfig.resourceNamingVersion,
      managedResourceNames: currentConfig.managedResourceNames,
      legacyAutoMigrationPending: currentConfig.legacyAutoMigrationPending,
    });

    const resourceIdsChangedManually =
      (datasetIdProvided && nextConfig.datasetId !== currentConfig.datasetId) ||
      (appIdProvided && nextConfig.appId !== currentConfig.appId) ||
      (apiKeyProvided && nextApiKey !== currentConfig.apiKey);
    if (resourceIdsChangedManually) {
      nextConfig.resourceManagementMode = 'manual';
      nextConfig.managedResourceNames = undefined;
      nextConfig.legacyAutoMigrationPending = false;
    }

    await this.persistConfig(nextConfig);
    return this.buildConfigView(nextConfig);
  }

  async getStatus(): Promise<AiQaStatus> {
    const aiQaConfig = await this.refreshLegacyMigrationPending(
      await this.ensureBlogInstanceId(await this.readConfig()),
    );
    return await this.buildStatusFromConfig(aiQaConfig);
  }

  private async buildStatusFromConfig(aiQaConfig: AiQaConfig): Promise<AiQaStatus> {
    const missingConfigFields = this.getMissingConfigFields(aiQaConfig);
    const [sources, mappings] = await Promise.all([
      this.collectKnowledgeSources(),
      this.structuredDataService.listAiKnowledgeSyncs({ includeDeleted: false }),
    ]);

    const sourceCounts = {
      article: 0,
      draft: 0,
      document: 0,
    } as Record<AiQaSourceType, number>;
    const syncedCounts = {
      article: 0,
      draft: 0,
      document: 0,
    } as Record<AiQaSourceType, number>;

    const mappingMap = new Map<string, AiKnowledgeSyncRecord>();
    mappings
      .filter((mapping) => !mapping.deletedAt)
      .forEach((mapping) => {
        mappingMap.set(this.buildSourceKey(mapping.sourceType, mapping.sourceId), mapping);
      });

    let syncedSources = 0;
    sources.forEach((source) => {
      sourceCounts[source.sourceType] += 1;
      const mapping = mappingMap.get(this.buildSourceKey(source.sourceType, source.sourceId));
      if (this.isKnowledgeMappingCurrent(mapping, source, aiQaConfig.datasetId)) {
        syncedCounts[mapping.sourceType] += 1;
        syncedSources += 1;
      }
    });

    return {
      enabled: aiQaConfig.enabled,
      configured: missingConfigFields.length === 0,
      missingConfigFields,
      fastgptInternalUrl: this.normalizeFastgptInternalUrl(config.fastgptInternalUrl),
      fastgptRootPasswordConfigured: Boolean(String(config.fastgptRootPassword || '').trim()),
      bundledModelConfigured: this.getBundledModelMissingFields(aiQaConfig).length === 0,
      bundledModelMissingFields: this.getBundledModelMissingFields(aiQaConfig),
      datasetId: aiQaConfig.datasetId,
      appId: aiQaConfig.appId,
      blogInstanceId: aiQaConfig.blogInstanceId,
      resourceManagementMode: this.resolveResourceManagementMode(aiQaConfig),
      resourceNamingVersion: AI_QA_RESOURCE_NAMING_VERSION,
      managedResourceNames: aiQaConfig.managedResourceNames,
      legacyAutoMigrationPending: aiQaConfig.legacyAutoMigrationPending,
      totalSources: sources.length,
      syncedSources,
      pendingSources: Math.max(sources.length - syncedSources, 0),
      sourceCounts,
      syncedCounts,
      lastSyncAt: aiQaConfig.runtime?.lastSyncAt || undefined,
      lastFullSyncAt: aiQaConfig.runtime?.lastFullSyncAt || undefined,
      lastSyncError: aiQaConfig.runtime?.lastSyncError || undefined,
      lastSyncSummary: aiQaConfig.runtime?.lastSyncSummary || null,
    };
  }

  async listConversations(page = 1, pageSize = 20): Promise<AiQaConversationListResponse> {
    const safePage = Math.max(1, Math.trunc(Number(page) || 1));
    const safePageSize = Math.min(100, Math.max(1, Math.trunc(Number(pageSize) || 20)));
    const result = await this.structuredDataService.listAiQaConversations(safePage, safePageSize);
    return {
      page: safePage,
      pageSize: safePageSize,
      total: result.total,
      items: result.conversations
        .map((item) => this.toConversationSummary(item as AiQaConversationRecord))
        .filter(Boolean) as AiQaConversationSummary[],
    };
  }

  async getConversationDetail(conversationId: string): Promise<AiQaConversationDetail> {
    const detail = await this.structuredDataService.getAiQaConversationDetail(
      String(conversationId || '').trim(),
    );
    if (!detail) {
      throw new BadRequestException('会话不存在或已删除');
    }
    return detail;
  }

  async renameConversation(
    conversationId: string,
    title: string,
  ): Promise<AiQaConversationSummary> {
    const conversation = await this.getConversationOrThrow(conversationId);
    const nextTitle = this.normalizeConversationTitle(title, conversation.title || '未命名会话');
    const updated = ((await this.structuredDataService.updateAiQaConversation(conversation.id, {
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    })) as AiQaConversationRecord | null) || {
      ...conversation,
      title: nextTitle,
    };
    return this.toConversationSummary(updated) as AiQaConversationSummary;
  }

  async deleteConversation(conversationId: string) {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.structuredDataService.updateAiQaConversation(conversation.id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return {
      id: conversation.id,
      deleted: true,
    };
  }

  async testConnection(question = 'VanBlog AI QA health check') {
    const aiQaConfig = await this.readConfig();
    this.assertConfigReady(aiQaConfig);

    const searchResults = await this.searchDataset(aiQaConfig, question);
    const chatPayload = await this.postFastgpt(
      '/api/v1/chat/completions',
      {
        stream: false,
        detail: false,
        messages: [
          {
            role: 'user',
            content: '请只回复 ok。',
          },
        ],
      },
      this.getChatAuthorization(aiQaConfig),
    );

    return {
      datasetReachable: true,
      chatReachable: Boolean(this.extractChatAnswer(chatPayload) || chatPayload?.choices?.length),
      searchHitCount: searchResults.length,
      chatPreview: this.extractChatAnswer(chatPayload),
    };
  }

  async syncBundledModels() {
    const aiQaConfig = await this.readConfig();
    this.assertBundledModelSyncReady(aiQaConfig);

    const llmMetadata = this.buildBundledLlmMetadata(aiQaConfig);
    const embeddingMetadata = this.buildBundledEmbeddingMetadata(aiQaConfig);
    const rootToken = await this.loginFastgptRootUser();

    await this.requestFastgptAsRootUser('POST', '/api/core/ai/model/update', rootToken, {
      body: {
        model: llmMetadata.model,
        metadata: llmMetadata,
      },
    });
    await this.requestFastgptAsRootUser('POST', '/api/core/ai/model/update', rootToken, {
      body: {
        model: embeddingMetadata.model,
        metadata: embeddingMetadata,
      },
    });
    await this.requestFastgptAsRootUser('POST', '/api/core/ai/model/updateDefault', rootToken, {
      body: {
        llm: llmMetadata.model,
        datasetTextLLM: llmMetadata.model,
        embedding: embeddingMetadata.model,
      },
    });

    return {
      llm: {
        model: llmMetadata.model,
        name: llmMetadata.name,
        requestUrl: llmMetadata.requestUrl,
      },
      embedding: {
        model: embeddingMetadata.model,
        name: embeddingMetadata.name,
        requestUrl: embeddingMetadata.requestUrl,
      },
    };
  }

  async provisionFastgptResources(): Promise<AiQaProvisionResult> {
    await this.syncBundledModels();

    const currentConfig = await this.ensureBlogInstanceId(await this.readConfig());
    this.assertBundledModelSyncReady(currentConfig);

    const rootToken = await this.loginFastgptRootUser();
    const managedResourceNames = await this.resolveManagedResourceNames(currentConfig);
    const dataset = await this.ensureManagedV2FastgptDataset(
      rootToken,
      currentConfig,
      managedResourceNames,
    );
    const app = await this.ensureManagedV2FastgptApp(
      rootToken,
      currentConfig,
      dataset,
      managedResourceNames,
    );
    const apiKeyResult = await this.ensureManagedV2FastgptAppApiKey(
      rootToken,
      currentConfig,
      app,
      managedResourceNames,
    );

    const nextConfig = this.normalizeConfig({
      ...currentConfig,
      datasetId: dataset.id,
      appId: app.id,
      apiKey: apiKeyResult.apiKey,
      resourceManagementMode: 'managedV2',
      managedResourceNames,
      legacyAutoMigrationPending: false,
    });
    await this.persistConfig(nextConfig);

    return {
      config: this.buildConfigView(nextConfig),
      status: await this.getStatus(),
      dataset,
      app,
      apiKey: {
        action: apiKeyResult.action,
        configured: Boolean(nextConfig.apiKey),
      },
    };
  }

  async testBundledModels() {
    const aiQaConfig = await this.readConfig();
    this.assertBundledModelTestReady(aiQaConfig);

    const llmConfig = aiQaConfig.bundledModels.llm;
    const embeddingConfig = aiQaConfig.bundledModels.embedding;

    const [llmPayload, embeddingPayload] = await Promise.all([
      this.requestBundledModelEndpoint(llmConfig.requestUrl, llmConfig.requestAuth, {
        model: llmConfig.model,
        messages: [{ role: 'user', content: '请简单回复: 服务连通正常。' }],
        temperature: 0,
        max_tokens: 128,
      }),
      this.requestBundledModelEndpoint(embeddingConfig.requestUrl, embeddingConfig.requestAuth, {
        model: embeddingConfig.model,
        input: '服务连通测试',
      }),
    ]);

    const llmPreview =
      typeof llmPayload === 'string'
        ? llmPayload
        : this.extractChatAnswer(llmPayload) || JSON.stringify(llmPayload);

    return {
      llm: {
        model: llmConfig.model,
        preview: llmPreview,
      },
      embedding: {
        model: embeddingConfig.model,
        vectorLength: this.extractEmbeddingVectorLength(embeddingPayload),
      },
    };
  }

  async migrateLegacyFastgptResources(): Promise<AiQaLegacyMigrationResult> {
    let currentConfig = await this.ensureBlogInstanceId(await this.readConfig());
    if (!currentConfig.legacyAutoMigrationPending) {
      currentConfig = await this.refreshLegacyMigrationPending(currentConfig);
    }

    const buildSkippedResult = async (reason: string): Promise<AiQaLegacyMigrationResult> => ({
      migrated: false,
      skipped: true,
      reason,
      config: this.buildConfigView(currentConfig),
      status: await this.buildStatusFromConfig(currentConfig),
    });

    if (
      !currentConfig.legacyAutoMigrationPending ||
      !this.shouldInspectLegacyAutoResources(currentConfig)
    ) {
      return await buildSkippedResult('当前配置不是可迁移的旧版 VanBlog 自动资源');
    }

    if (!this.hasFastgptRootPasswordConfigured()) {
      return await buildSkippedResult('未配置 FastGPT root 密码，暂不执行旧资源迁移');
    }

    if (this.getBundledModelMissingFields(currentConfig).length) {
      return await buildSkippedResult('bundled FastGPT 模型配置缺失，暂不执行旧资源迁移');
    }

    return await this.enqueueSync(async () => {
      await this.syncBundledModels();

      const rootToken = await this.loginFastgptRootUser();
      const stillLegacy = await this.isLegacyAutoManagedResourceSet(currentConfig, rootToken);
      if (!stillLegacy) {
        currentConfig = this.normalizeConfig({
          ...currentConfig,
          legacyAutoMigrationPending: false,
        });
        await this.persistConfig(currentConfig);
        return await buildSkippedResult('旧资源特征已不匹配，已跳过自动迁移');
      }

      const legacyDatasetId = currentConfig.datasetId;
      const legacyAppId = currentConfig.appId;
      const managedResourceNames = await this.resolveManagedResourceNames(currentConfig);
      const dataset = await this.ensureManagedV2FastgptDataset(
        rootToken,
        currentConfig,
        managedResourceNames,
      );
      const app = await this.ensureManagedV2FastgptApp(
        rootToken,
        currentConfig,
        dataset,
        managedResourceNames,
      );
      const apiKeyResult = await this.ensureManagedV2FastgptAppApiKey(
        rootToken,
        currentConfig,
        app,
        managedResourceNames,
      );

      const nextConfig = this.normalizeConfig({
        ...currentConfig,
        datasetId: dataset.id,
        appId: app.id,
        apiKey: apiKeyResult.apiKey,
        resourceManagementMode: 'managedV2',
        managedResourceNames,
        legacyAutoMigrationPending: false,
        runtime: currentConfig.runtime,
      });

      const summary = await this.performFullSyncWithConfig(nextConfig, 'legacy-migration');

      nextConfig.runtime = {
        ...(nextConfig.runtime || {}),
        lastSyncAt: summary.finishedAt,
        lastFullSyncAt: summary.finishedAt,
        lastSyncError: summary.failed ? `legacy-migration 同步包含 ${summary.failed} 个失败项` : '',
        lastSyncSummary: summary,
      };
      await this.persistConfig(nextConfig);

      let warning = '';
      try {
        await this.deleteFastgptApp(rootToken, legacyAppId);
      } catch (error) {
        warning = `删除旧版 FastGPT App 失败: ${this.getFastgptErrorMessage(error)}`;
        this.logger.warn(warning);
      }
      try {
        await this.deleteFastgptDataset(rootToken, legacyDatasetId);
      } catch (error) {
        const datasetWarning = `删除旧版 FastGPT Dataset 失败: ${this.getFastgptErrorMessage(
          error,
        )}`;
        warning = warning ? `${warning}; ${datasetWarning}` : datasetWarning;
        this.logger.warn(datasetWarning);
      }

      return {
        migrated: true,
        warning: warning || undefined,
        config: this.buildConfigView(nextConfig),
        status: await this.getStatus(),
        dataset,
        app,
        apiKey: {
          action: apiKeyResult.action,
          configured: Boolean(nextConfig.apiKey),
        },
        syncSummary: summary,
      };
    });
  }

  private async performFullSyncWithConfig(
    aiQaConfig: AiQaConfig,
    trigger: string,
  ): Promise<AiQaSyncSummary> {
    const summary: AiQaSyncSummary = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      failed: 0,
      trigger,
      finishedAt: '',
    };

    const [sources, existingMappings] = await Promise.all([
      this.collectKnowledgeSources(),
      this.structuredDataService.listAiKnowledgeSyncs({ includeDeleted: false }),
    ]);
    summary.total = sources.length;

    const currentKeys = new Set(
      sources.map((source) => this.buildSourceKey(source.sourceType, source.sourceId)),
    );

    for (const source of sources) {
      try {
        const result = await this.syncOneSource(aiQaConfig, source);
        summary[result] += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.error(
          `AI 问答同步失败: ${source.sourceType}:${source.sourceId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    for (const mapping of existingMappings) {
      const key = this.buildSourceKey(mapping.sourceType, mapping.sourceId);
      if (!currentKeys.has(key) || mapping.datasetId !== aiQaConfig.datasetId) {
        try {
          const removed = await this.removeSourceByKey(
            aiQaConfig,
            mapping.sourceType,
            mapping.sourceId,
          );
          if (removed) {
            summary.deleted += 1;
          }
        } catch (error) {
          summary.failed += 1;
          this.logger.error(
            `AI 问答清理失效映射失败: ${mapping.sourceType}:${mapping.sourceId}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    summary.finishedAt = new Date().toISOString();
    return summary;
  }

  async runFullSync(trigger = 'manual'): Promise<AiQaSyncSummary> {
    const aiQaConfig = await this.ensureBlogInstanceId(await this.readConfig());
    this.assertConfigReady(aiQaConfig);

    return await this.enqueueSync(async () => {
      try {
        const summary = await this.performFullSyncWithConfig(aiQaConfig, trigger);
        await this.writeRuntimePatch({
          lastSyncAt: summary.finishedAt,
          lastFullSyncAt: summary.finishedAt,
          lastSyncError: summary.failed ? `${trigger} 同步包含 ${summary.failed} 个失败项` : '',
          lastSyncSummary: summary,
        });

        return summary;
      } catch (error) {
        await this.markSyncFailure(trigger, error);
        throw error;
      }
    });
  }

  async runNightlyFullSync() {
    const aiQaConfig = await this.ensureBlogInstanceId(await this.readConfig());
    if (!aiQaConfig.enabled || this.getMissingConfigFields(aiQaConfig).length) {
      return null;
    }
    return await this.runFullSync('nightly');
  }

  async syncArticleById(articleId: number, trigger = 'article-update') {
    return await this.syncSourceById('article', String(articleId), trigger);
  }

  async syncDraftById(draftId: number, trigger = 'draft-update') {
    return await this.syncSourceById('draft', String(draftId), trigger);
  }

  async syncDocumentById(documentId: number, trigger = 'document-update') {
    return await this.syncSourceById('document', String(documentId), trigger);
  }

  async syncSourceById(sourceType: AiQaSourceType, sourceId: string, trigger = 'incremental-sync') {
    const aiQaConfig = await this.ensureBlogInstanceId(await this.readConfig());
    if (!aiQaConfig.enabled || this.getMissingConfigFields(aiQaConfig).length) {
      return { skipped: true };
    }

    return await this.enqueueSync(async () => {
      try {
        const source = await this.getKnowledgeSourceById(sourceType, sourceId);
        let action: 'created' | 'updated' | 'skipped' | 'deleted' = 'skipped';

        if (!source) {
          const removed = await this.removeSourceByKey(aiQaConfig, sourceType, sourceId);
          action = removed ? 'deleted' : 'skipped';
        } else {
          action = await this.syncOneSource(aiQaConfig, source);
        }

        await this.writeRuntimePatch({
          lastSyncAt: new Date().toISOString(),
          lastSyncError: '',
        });
        return { action };
      } catch (error) {
        await this.markSyncFailure(trigger, error);
        throw error;
      }
    });
  }

  async deleteSource(sourceType: AiQaSourceType, sourceId: string, trigger = 'source-delete') {
    const aiQaConfig = await this.ensureBlogInstanceId(await this.readConfig());
    if (!aiQaConfig.enabled || this.getMissingConfigFields(aiQaConfig).length) {
      return { skipped: true };
    }

    return await this.enqueueSync(async () => {
      try {
        const removed = await this.removeSourceByKey(aiQaConfig, sourceType, sourceId);
        await this.writeRuntimePatch({
          lastSyncAt: new Date().toISOString(),
          lastSyncError: '',
        });
        return { deleted: removed };
      } catch (error) {
        await this.markSyncFailure(trigger, error);
        throw error;
      }
    });
  }

  async deleteDocumentTreeByRootId(documentId: number, trigger = 'document-delete') {
    const aiQaConfig = await this.ensureBlogInstanceId(await this.readConfig());
    if (!aiQaConfig.enabled || this.getMissingConfigFields(aiQaConfig).length) {
      return { skipped: true };
    }

    return await this.enqueueSync(async () => {
      try {
        const subtree = await this.structuredDataService.getDocumentSubtree(documentId, true);
        const sourceIds = subtree.length
          ? subtree.map((item: any) => String(item.id))
          : [String(documentId)];

        let deleted = 0;
        for (const sourceId of sourceIds) {
          const removed = await this.removeSourceByKey(aiQaConfig, 'document', sourceId);
          if (removed) {
            deleted += 1;
          }
        }

        await this.writeRuntimePatch({
          lastSyncAt: new Date().toISOString(),
          lastSyncError: '',
        });
        return { deleted };
      } catch (error) {
        await this.markSyncFailure(trigger, error);
        throw error;
      }
    });
  }

  async chat(
    question: string,
    options: {
      conversationId?: string;
      chatId?: string;
      actor?: AiQaConversationActor;
    } = {},
  ): Promise<AiQaChatResponse> {
    const normalizedQuestion = String(question || '').trim();
    if (!normalizedQuestion) {
      throw new BadRequestException('问题不能为空');
    }

    const aiQaConfig = await this.readConfig();
    this.assertConfigReady(aiQaConfig, { requireEnabled: true });

    const resolvedConversation = await this.resolveConversationForChat(
      options.conversationId,
      options.chatId,
    );
    const payload = await this.postFastgpt(
      '/api/v1/chat/completions',
      {
        chatId: resolvedConversation.chatId,
        stream: false,
        detail: true,
        messages: [
          {
            role: 'user',
            content: normalizedQuestion,
          },
        ],
      },
      this.getChatAuthorization(aiQaConfig),
    );

    const citations = await this.enrichCitations(this.extractQuoteList(payload));
    const grounded = citations.length > 0;
    const answer =
      this.extractChatAnswer(payload) ||
      '我暂时没能整理出一个明确回答，你可以换个更具体的问题再试试。';
    const savedTurn = await this.persistChatTurn({
      conversation: resolvedConversation.conversation,
      chatId: resolvedConversation.chatId,
      question: normalizedQuestion,
      answer,
      grounded,
      citations,
      actor: options.actor,
    });

    return {
      conversationId: savedTurn.conversation.id,
      conversation: savedTurn.conversation,
      chatId: resolvedConversation.chatId,
      userMessage: savedTurn.userMessage,
      assistantMessage: savedTurn.assistantMessage,
      answer,
      grounded,
      citations,
    };
  }
}
