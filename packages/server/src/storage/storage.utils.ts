const IRREGULAR_COLLECTIONS: Record<string, string> = {
  Article: 'articles',
  Category: 'categories',
  CustomPage: 'custompages',
  Document: 'documents',
  Draft: 'drafts',
  Icon: 'icons',
  Meta: 'meta',
  MindMap: 'mindmaps',
  Moment: 'moments',
  NavCategory: 'navcategories',
  NavTool: 'navtools',
  Pipeline: 'pipelines',
  Setting: 'settings',
  Static: 'statics',
  Tag: 'tags',
  Token: 'tokens',
  User: 'users',
  Viewer: 'viewers',
  Visit: 'visits',
};

export const getCollectionName = (modelName: string) => {
  if (IRREGULAR_COLLECTIONS[modelName]) {
    return IRREGULAR_COLLECTIONS[modelName];
  }

  const lower = modelName.toLowerCase();
  if (lower.endsWith('y')) {
    return `${lower.slice(0, -1)}ies`;
  }
  if (lower.endsWith('s')) {
    return `${lower}es`;
  }
  return `${lower}s`;
};

export const isPlainObject = (value: unknown): value is Record<string, any> => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
};

export const deepClone = <T>(value: T): T => {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }
  if (isPlainObject(value)) {
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = deepClone(item);
    }
    return result as T;
  }
  return value;
};

export const maybeDateValue = (value: any) => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    const ts = Date.parse(value);
    if (!Number.isNaN(ts) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return ts;
    }
  }
  return value;
};
