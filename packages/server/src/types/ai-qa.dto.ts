export type AiQaSourceType = 'article' | 'draft' | 'document';
export type FastgptSearchMode = 'embedding' | 'fullTextRecall' | 'mixedRecall';
export type AiQaMessageRole = 'user' | 'assistant';
export type AiQaResourceManagementMode = 'manual' | 'managedV2';

export interface AiQaManagedResourceNames {
  dataset: string;
  app: string;
  apiKey: string;
}

export interface AiQaSyncSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  failed: number;
  trigger: string;
  finishedAt: string;
}

export interface AiQaRuntimeState {
  lastSyncAt?: string;
  lastFullSyncAt?: string;
  lastSyncError?: string;
  lastSyncSummary?: AiQaSyncSummary | null;
}

export interface AiQaBundledModelConfigItem {
  requestUrl: string;
  requestAuth: string;
  model: string;
  name: string;
}

export interface AiQaBundledModelConfig {
  llm: AiQaBundledModelConfigItem;
  embedding: AiQaBundledModelConfigItem;
}

export interface AiQaConfig {
  enabled: boolean;
  datasetId: string;
  appId: string;
  apiKey: string;
  blogInstanceId: string;
  resourceManagementMode?: AiQaResourceManagementMode;
  resourceNamingVersion: 2;
  managedResourceNames?: AiQaManagedResourceNames;
  legacyAutoMigrationPending: boolean;
  searchMode: FastgptSearchMode;
  limit: number;
  similarity: number;
  usingReRank: boolean;
  datasetSearchUsingExtensionQuery: boolean;
  datasetSearchExtensionModel?: string;
  datasetSearchExtensionBg?: string;
  bundledModels: AiQaBundledModelConfig;
  runtime?: AiQaRuntimeState;
}

export interface AiQaBundledModelConfigItemView
  extends Omit<AiQaBundledModelConfigItem, 'requestAuth'> {
  requestAuth: string;
  requestAuthConfigured: boolean;
}

export interface AiQaBundledModelConfigView {
  llm: AiQaBundledModelConfigItemView;
  embedding: AiQaBundledModelConfigItemView;
}

export interface AiQaConfigView extends Omit<AiQaConfig, 'apiKey' | 'resourceManagementMode'> {
  apiKey: string;
  apiKeyConfigured: boolean;
  fastgptInternalUrl: string;
  fastgptRootPasswordConfigured: boolean;
  resourceManagementMode: AiQaResourceManagementMode;
  bundledModels: AiQaBundledModelConfigView;
}

export interface AiQaKnowledgeSource {
  sourceType: AiQaSourceType;
  sourceId: string;
  title: string;
  content: string;
  updatedAt: string;
  publicUrl?: string;
  editorUrl: string;
}

export interface AiQaCitation {
  collectionId?: string;
  sourceType?: AiQaSourceType;
  sourceId?: string;
  title: string;
  score?: number;
  question?: string;
  answer?: string;
  sourceName?: string;
  editorUrl?: string;
  publicUrl?: string;
}

export interface AiQaConversationActor {
  userId?: number;
  name?: string;
  nickname?: string;
}

export interface AiQaConversationSummary {
  id: string;
  chatId: string;
  title: string;
  createdByUserId?: number;
  createdByName?: string;
  createdByNickname?: string;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiQaConversationMessage {
  id: string;
  conversationId: string;
  role: AiQaMessageRole;
  content: string;
  grounded: boolean;
  citations: AiQaCitation[];
  createdAt: string;
  createdByUserId?: number;
  createdByName?: string;
  createdByNickname?: string;
}

export interface AiQaConversationDetail extends AiQaConversationSummary {
  messages: AiQaConversationMessage[];
}

export interface AiQaConversationListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: AiQaConversationSummary[];
}

export interface AiQaChatResponse {
  conversationId: string;
  conversation: AiQaConversationSummary;
  chatId: string;
  userMessage: AiQaConversationMessage;
  assistantMessage: AiQaConversationMessage;
  answer: string;
  grounded: boolean;
  citations: AiQaCitation[];
}

export interface AiQaConversationRecord extends AiQaConversationSummary {
  deletedAt?: string | null;
}

export interface AiQaMessageRecord extends AiQaConversationMessage {}

export interface AiKnowledgeSyncRecord {
  sourceType: AiQaSourceType;
  sourceId: string;
  contentHash: string;
  datasetId: string;
  collectionId: string;
  title: string;
  publicUrl?: string;
  editorUrl?: string;
  updatedAt: string;
  lastSyncedAt: string;
  deletedAt?: string | null;
}

export interface AiQaStatus {
  enabled: boolean;
  configured: boolean;
  missingConfigFields: string[];
  fastgptInternalUrl: string;
  fastgptRootPasswordConfigured: boolean;
  bundledModelConfigured: boolean;
  bundledModelMissingFields: string[];
  datasetId: string;
  appId: string;
  blogInstanceId: string;
  resourceManagementMode: AiQaResourceManagementMode;
  resourceNamingVersion: 2;
  managedResourceNames?: AiQaManagedResourceNames;
  legacyAutoMigrationPending: boolean;
  totalSources: number;
  syncedSources: number;
  pendingSources: number;
  sourceCounts: Record<AiQaSourceType, number>;
  syncedCounts: Record<AiQaSourceType, number>;
  lastSyncAt?: string;
  lastFullSyncAt?: string;
  lastSyncError?: string;
  lastSyncSummary?: AiQaSyncSummary | null;
}

export type AiQaProvisionAction = 'created' | 'updated' | 'reused';

export interface AiQaProvisionResource {
  id: string;
  name: string;
  action: AiQaProvisionAction;
}

export interface AiQaProvisionApiKeyResult {
  action: AiQaProvisionAction;
  configured: boolean;
}

export interface AiQaProvisionResult {
  config: AiQaConfigView;
  status: AiQaStatus;
  dataset: AiQaProvisionResource;
  app: AiQaProvisionResource;
  apiKey: AiQaProvisionApiKeyResult;
}

export interface AiQaLegacyMigrationResult {
  migrated: boolean;
  skipped?: boolean;
  reason?: string;
  warning?: string;
  config: AiQaConfigView;
  status: AiQaStatus;
  dataset?: AiQaProvisionResource;
  app?: AiQaProvisionResource;
  apiKey?: AiQaProvisionApiKeyResult;
  syncSummary?: AiQaSyncSummary;
}

export const defaultAiQaConfig: AiQaConfig = {
  enabled: false,
  datasetId: '',
  appId: '',
  apiKey: '',
  blogInstanceId: '',
  resourceManagementMode: undefined,
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
  runtime: {
    lastSyncAt: '',
    lastFullSyncAt: '',
    lastSyncError: '',
    lastSyncSummary: null,
  },
};
