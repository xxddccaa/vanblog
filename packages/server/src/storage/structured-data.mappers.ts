export function asDate(value: any) {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

export function dedupeRecords<T>(
  records: T[],
  label: string,
  getKey: (record: T) => string | null | undefined,
  onDuplicate?: (count: number) => void,
): T[] {
  const deduped = new Map<string, T>();
  for (const record of records || []) {
    const key = getKey(record);
    if (!key) {
      continue;
    }
    deduped.set(String(key), record);
  }
  if (deduped.size !== (records || []).length) {
    onDuplicate?.((records || []).length - deduped.size);
  }
  return Array.from(deduped.values());
}

export function normalizeNumericId(value: any) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function normalizeArticleCategories(categories?: any, category?: string) {
  const rawCategories = Array.isArray(categories) ? categories : [];
  const source = rawCategories.length ? rawCategories : category ? [category] : [];
  return [...new Set(source.map((item) => String(item || '').trim()).filter(Boolean))];
}

export function mapUserRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    name: row.name,
    password: row.password,
    createdAt: row.created_at,
    type: row.user_type,
    nickname: row.nickname || undefined,
    permissions: row.permissions ?? undefined,
    salt: row.salt,
  };
}

export function mapSettingRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    type: row.setting_type,
    value: row.setting_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMetaRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    links: row.links || [],
    socials: row.socials || [],
    menus: row.menus || [],
    rewards: row.rewards || [],
    about: row.about || {},
    siteInfo: row.site_info || {},
    viewer: Number(row.viewer || 0),
    visited: Number(row.visited || 0),
    categories: row.categories || [],
    totalWordCount: Number(row.total_word_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapViewerRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    visited: Number(row.visited || 0),
    viewer: Number(row.viewer || 0),
    date: row.date,
    createdAt: row.created_at,
  };
}

export function mapVisitRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    visited: Number(row.visited || 0),
    viewer: Number(row.viewer || 0),
    date: row.date,
    pathname: row.pathname,
    lastVisitedTime: row.last_visited_time || undefined,
    createdAt: row.created_at,
  };
}

export function mapArticleRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    title: row.title,
    content: row.content || '',
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    category: row.category || undefined,
    categories: normalizeArticleCategories(row.categories, row.category || undefined),
    top: Number(row.top_value || 0),
    hidden: Boolean(row.hidden),
    private: Boolean(row.private_flag),
    deleted: Boolean(row.deleted),
    viewer: Number(row.viewer || 0),
    visited: Number(row.visited || 0),
    author: row.author || undefined,
    password: row.password || undefined,
    pathname: row.pathname || undefined,
    copyright: row.copyright || undefined,
    lastVisitedTime: row.last_visited_time || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTagRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    name: row.name,
    articleCount: Number(row.article_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDraftRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    title: row.title,
    content: row.content || '',
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    author: row.author || undefined,
    category: row.category || undefined,
    deleted: Boolean(row.deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCustomPageRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    name: row.name,
    path: row.path,
    type: row.page_type,
    html: row.html || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNavCategoryRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.id || row.source_record_id,
    name: row.name,
    description: row.description || undefined,
    sort: Number(row.sort_order || 0),
    hide: Boolean(row.hide),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    toolCount:
      row.tool_count === undefined || row.tool_count === null ? undefined : Number(row.tool_count),
  };
}

export function mapNavToolRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.id || row.source_record_id,
    name: row.name,
    url: row.url,
    logo: row.logo || undefined,
    categoryId: row.category_id,
    categoryName: row.category_name || undefined,
    description: row.description || undefined,
    sort: Number(row.sort_order || 0),
    hide: Boolean(row.hide),
    useCustomIcon: Boolean(row.use_custom_icon),
    customIcon: row.custom_icon || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapIconRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    name: row.name,
    type: row.icon_type,
    usage: row.usage || 'social',
    iconUrl: row.icon_url,
    iconUrlDark: row.icon_url_dark || undefined,
    presetIconType: row.preset_icon_type || undefined,
    description: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPipelineRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    name: row.name,
    eventType: row.event_type || undefined,
    description: row.description || undefined,
    enabled: Boolean(row.enabled),
    deps: Array.isArray(row.deps) ? row.deps.filter(Boolean) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventName: row.event_name,
    script: row.script || '',
    deleted: Boolean(row.deleted),
  };
}

export function mapTokenRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    userId: Number(row.user_id || 0),
    token: row.token,
    name: row.name || undefined,
    expiresIn: Number(row.expires_in || 0),
    createdAt: row.created_at,
    disabled: Boolean(row.disabled),
  };
}

export function mapStaticRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    staticType: row.static_type,
    storageType: row.storage_type,
    fileType: row.file_type || undefined,
    realPath: row.real_path,
    meta: row.meta ?? undefined,
    name: row.name,
    sign: row.sign,
    updatedAt: row.updated_at,
  };
}

export function mapCategoryRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    name: row.name,
    type: row.category_type,
    private: Boolean(row.private_flag),
    password: row.password || undefined,
    sort: Number(row.sort_order || 0),
    meta: row.meta ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDocumentRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    title: row.title,
    content: row.content || '',
    author: row.author || undefined,
    parent_id: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id),
    library_id:
      row.library_id === null || row.library_id === undefined ? null : Number(row.library_id),
    type: row.document_type,
    path: Array.isArray(row.path) ? row.path.map((item: any) => Number(item)) : [],
    sort_order: Number(row.sort_order || 0),
    deleted: Boolean(row.deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMomentRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.source_record_id || undefined,
    id: Number(row.id),
    content: row.content,
    deleted: Boolean(row.deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMindMapRow(row: any) {
  if (!row) {
    return null;
  }
  return {
    _id: row.id || row.source_record_id,
    title: row.title,
    content: row.content || '',
    author: row.author || undefined,
    description: row.description || '',
    viewer: Number(row.viewer || 0),
    deleted: Boolean(row.deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
