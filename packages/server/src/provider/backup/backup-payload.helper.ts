import { removeID } from './removeId';

export interface PreparedImportPayload {
  backupVersion: string;
  currentAdmin: any;
  canRestoreProtectedData: boolean;
  includeAnalytics: boolean;
  meta: any;
  user: any;
  users: any[];
  setting: any;
  settings: any[];
  layoutSetting: any;
  aiTaggingConfig: any;
  categories: any[];
  tags: any[];
  articles: any[];
  drafts: any[];
  viewer: any[];
  visit: any[];
  staticItems: any[];
  moments: any[];
  customPages: any[];
  pipelines: any[];
  tokens: any[];
  navTools: any[];
  navCategories: any[];
  icons: any[];
  documents: any[];
  mindMaps: any[];
  /** Raw `comments` and `comment_likes` records; only present in backups that contain them. */
  comments: any[];
  commentLikes: any[];
}

export type StructuredImportCollection =
  | 'articles'
  | 'drafts'
  | 'documents'
  | 'moments'
  | 'comments'
  | 'commentLikes';

export function cloneAdminSnapshot(currentAdmin: any) {
  if (!currentAdmin) {
    return currentAdmin;
  }
  if (typeof currentAdmin.toObject === 'function') {
    return currentAdmin.toObject();
  }
  return JSON.parse(JSON.stringify(currentAdmin));
}

export function sanitizeArray(items: any[] | undefined, useRemoveId = true) {
  if (!items?.length) {
    return [];
  }
  return useRemoveId ? removeID(items) : items.map((item) => ({ ...item }));
}

export function shouldReportProgress(processed: number, total: number) {
  if (processed <= 1 || processed === total) {
    return true;
  }
  if (total <= 20) {
    return true;
  }
  if (total <= 200) {
    return processed % 5 === 0;
  }
  if (total <= 2000) {
    return processed % 20 === 0;
  }
  return processed % 50 === 0;
}

export function getImportConcurrency(total: number, max = 8) {
  if (total <= 1) {
    return 1;
  }
  return Math.max(1, Math.min(max, total));
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  if (!items?.length) {
    return;
  }

  const runnerCount = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: runnerCount }, async () => {
      while (true) {
        const currentIndex = cursor++;
        if (currentIndex >= items.length) {
          return;
        }
        await worker(items[currentIndex], currentIndex);
      }
    }),
  );
}

export function parseIncludeAnalyticsFlag(value: any) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return false;
}

export function sanitizeTokensForBackup(_tokens: any[]) {
  return [];
}

export function sanitizeRawCollectionsForBackup(
  rawCollections: Record<string, any[]>,
): Record<string, any[]> {
  return {
    ...(rawCollections || {}),
    tokens: [],
  };
}

export function buildImportSummary(prepared: PreparedImportPayload) {
  return {
    backupVersion: prepared.backupVersion,
    includeAnalytics: prepared.includeAnalytics,
    counts: {
      articles: prepared.articles.length,
      drafts: prepared.drafts.length,
      moments: prepared.moments.length,
      documents: prepared.documents.length,
      mindMaps: prepared.mindMaps.length,
      comments: prepared.comments.length,
      commentLikes: prepared.commentLikes.length,
      settings: prepared.settings?.length || 0,
      staticItems: prepared.staticItems.length,
      tokens: prepared.tokens.length,
      visit: prepared.visit.length,
      viewer: prepared.viewer.length,
    },
  };
}

export function buildImportStages(prepared: PreparedImportPayload) {
  const stages: Array<{ key: string; label: string; total?: number }> = [];
  if (!prepared.canRestoreProtectedData) {
    stages.push({ key: 'cleanupExisting', label: '清理现有站点数据', total: 1 });
  }
  if ((prepared.users?.length || 0) > 0 || prepared.currentAdmin?.id !== undefined) {
    stages.push({
      key: 'users',
      label: '恢复管理员账号',
      total: Math.max(prepared.users?.length || 0, 1),
    });
  }
  if (prepared.meta) {
    stages.push({ key: 'meta', label: '恢复站点信息', total: 1 });
  }
  if ((prepared.settings?.length || 0) > 0 || prepared.setting) {
    stages.push({
      key: 'settings',
      label: '恢复系统设置',
      total: Math.max(prepared.settings?.length || 0, 1),
    });
  }
  if (prepared.categories.length > 0) {
    stages.push({ key: 'categories', label: '恢复分类', total: prepared.categories.length });
  }
  if (prepared.articles.length > 0) {
    stages.push({ key: 'articles', label: '恢复文章', total: prepared.articles.length });
  }
  if (prepared.drafts.length > 0) {
    stages.push({ key: 'drafts', label: '恢复草稿', total: prepared.drafts.length });
  }
  if (prepared.moments.length > 0) {
    stages.push({ key: 'moments', label: '恢复动态', total: prepared.moments.length });
  }
  if (prepared.customPages.length > 0) {
    stages.push({
      key: 'customPages',
      label: '恢复自定义页面',
      total: prepared.customPages.length,
    });
  }
  if (prepared.navCategories.length > 0) {
    stages.push({
      key: 'navCategories',
      label: '恢复导航分类',
      total: prepared.navCategories.length,
    });
  }
  if (prepared.navTools.length > 0) {
    stages.push({ key: 'navTools', label: '恢复导航工具', total: prepared.navTools.length });
  }
  if (prepared.icons.length > 0) {
    stages.push({ key: 'icons', label: '恢复图标', total: prepared.icons.length });
  }
  if (prepared.pipelines.length > 0) {
    stages.push({ key: 'pipelines', label: '恢复流水线', total: prepared.pipelines.length });
  }
  if (prepared.tokens.length > 0) {
    stages.push({ key: 'tokens', label: '恢复 Token', total: prepared.tokens.length });
  }
  if (prepared.staticItems.length > 0) {
    stages.push({
      key: 'staticItems',
      label: '恢复静态文件记录',
      total: prepared.staticItems.length,
    });
  }
  stages.push({
    key: 'analytics',
    label: '访问统计数据',
    total: Math.max(prepared.visit.length + prepared.viewer.length, 1),
  });
  if (prepared.layoutSetting && Object.keys(prepared.layoutSetting).length > 0) {
    stages.push({ key: 'layoutSetting', label: '恢复定制化设置', total: 1 });
  }
  if (prepared.aiTaggingConfig && Object.keys(prepared.aiTaggingConfig).length > 0) {
    stages.push({ key: 'aiTaggingConfig', label: '恢复 AI 标签配置', total: 1 });
  }
  if (prepared.documents.length > 0) {
    stages.push({ key: 'documents', label: '恢复私密文档', total: prepared.documents.length });
  }
  if (prepared.mindMaps.length > 0) {
    stages.push({ key: 'mindMaps', label: '恢复思维导图', total: prepared.mindMaps.length });
  }
  if (prepared.comments.length > 0) {
    stages.push({ key: 'comments', label: '恢复评论', total: prepared.comments.length });
  }
  stages.push({ key: 'structuredData', label: '同步结构化数据', total: 1 });
  stages.push({ key: 'syncTags', label: '同步标签与前台缓存', total: 1 });
  return stages;
}

export function getStructuredCollectionsForImport(prepared: PreparedImportPayload) {
  const collections: StructuredImportCollection[] = [];
  if (prepared.articles.length > 0) {
    collections.push('articles');
  }
  if (prepared.drafts.length > 0) {
    collections.push('drafts');
  }
  if (prepared.moments.length > 0) {
    collections.push('moments');
  }
  if (prepared.documents.length > 0) {
    collections.push('documents');
  }
  if (prepared.comments.length > 0) {
    collections.push('comments', 'commentLikes');
  }
  return collections;
}

export function throwIfImportFailures(stageLabel: string, failures: string[]) {
  if (!failures.length) {
    return;
  }
  const preview = failures.slice(0, 3).join('；');
  const suffix = failures.length > 3 ? `；另有 ${failures.length - 3} 条失败` : '';
  throw new Error(`${stageLabel} 恢复不完整，失败 ${failures.length} 条：${preview}${suffix}`);
}

export function normalizeBackupPayload(data: any) {
  const mongoCollections = data?.rawCollections || data?.mongoCollections || {};
  const settings = data?.settings || getCollection(mongoCollections, ['settings']);

  return {
    ...data,
    articles: data?.articles ?? getCollection(mongoCollections, ['articles']),
    drafts: data?.drafts ?? getCollection(mongoCollections, ['drafts']),
    meta: data?.meta ?? getFirstDocument(mongoCollections, ['metas', 'meta']),
    categories: data?.categories ?? getCollection(mongoCollections, ['categories']),
    tags: data?.tags ?? getCollection(mongoCollections, ['tags']),
    user:
      data?.user ??
      (Array.isArray(data?.users)
        ? data.users.find((item: any) => item?.id === 0)
        : getAdminUserFromCollection(mongoCollections)),
    users: data?.users ?? getCollection(mongoCollections, ['users']),
    viewer: data?.viewer ?? getCollection(mongoCollections, ['viewers']),
    visit: data?.visit ?? getCollection(mongoCollections, ['visits']),
    static: data?.static ?? getCollection(mongoCollections, ['statics', 'static']),
    setting: data?.setting ?? buildLegacySettingPayload(settings),
    settings,
    moments: data?.moments ?? getCollection(mongoCollections, ['moments']),
    customPages:
      data?.customPages ?? getCollection(mongoCollections, ['custompages', 'customPages']),
    pipelines: data?.pipelines ?? getCollection(mongoCollections, ['pipelines']),
    tokens: data?.tokens ?? getCollection(mongoCollections, ['tokens']),
    navTools: data?.navTools ?? getCollection(mongoCollections, ['navtools', 'navTools']),
    navCategories:
      data?.navCategories ?? getCollection(mongoCollections, ['navcategories', 'navCategories']),
    icons: data?.icons ?? getCollection(mongoCollections, ['icons']),
    layoutSetting: data?.layoutSetting ?? findSettingValue(settings, 'layout'),
    aiTaggingConfig: data?.aiTaggingConfig ?? findSettingValue(settings, 'aiTagging'),
    documents: data?.documents ?? getCollection(mongoCollections, ['documents']),
    mindMaps: data?.mindMaps ?? getCollection(mongoCollections, ['mindmaps', 'mindMaps']),
    comments: data?.comments ?? getCollection(mongoCollections, ['comments']),
    commentLikes:
      data?.commentLikes ?? getCollection(mongoCollections, ['comment_likes', 'commentLikes']),
  };
}

export function getCollection(collections: Record<string, any[]>, names: string[]) {
  for (const name of names) {
    if (Array.isArray(collections?.[name])) {
      return collections[name];
    }
  }
  return undefined;
}

export function getFirstDocument(collections: Record<string, any[]>, names: string[]) {
  const docs = getCollection(collections, names);
  if (!Array.isArray(docs) || docs.length === 0) {
    return undefined;
  }
  return docs[0];
}

export function getAdminUserFromCollection(collections: Record<string, any[]>) {
  const users = getCollection(collections, ['users']);
  if (!Array.isArray(users)) {
    return undefined;
  }
  return users.find((item: any) => item?.id === 0);
}

export function buildLegacySettingPayload(settings: any[] | undefined) {
  const staticSetting = findSettingValue(settings, 'static');
  if (!staticSetting) {
    return undefined;
  }
  return {
    static: staticSetting,
  };
}

export function findSettingValue(settings: any[] | undefined, type: string) {
  if (!Array.isArray(settings)) {
    return undefined;
  }
  const item = settings.find((setting) => setting?.type === type);
  return item?.value;
}
