import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PostgresStoreService } from './postgres-store.service';
import { SearchArticleOption } from 'src/types/article.dto';

@Injectable()
export class StructuredDataService implements OnModuleInit {
  private readonly logger = new Logger(StructuredDataService.name);
  private initialized = false;
  private readonly numericIdSequences = [
    { name: 'vanblog_users_id_seq', table: 'vanblog_users', column: 'id' },
    { name: 'vanblog_articles_id_seq', table: 'vanblog_articles', column: 'id' },
    { name: 'vanblog_drafts_id_seq', table: 'vanblog_drafts', column: 'id' },
    { name: 'vanblog_pipelines_id_seq', table: 'vanblog_pipelines', column: 'id' },
    { name: 'vanblog_categories_id_seq', table: 'vanblog_categories', column: 'id' },
    { name: 'vanblog_documents_id_seq', table: 'vanblog_documents', column: 'id' },
    { name: 'vanblog_moments_id_seq', table: 'vanblog_moments', column: 'id' },
  ] as const;

  constructor(private readonly store: PostgresStoreService) {}

  async onModuleInit() {
    await this.ensureSchema();
    await this.refreshAllFromRecordStore('startup');
    this.initialized = true;
  }

  async ensureSchema() {
    await this.store.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    for (const sequence of this.numericIdSequences) {
      await this.store.query(`CREATE SEQUENCE IF NOT EXISTS ${sequence.name} START WITH 1 INCREMENT BY 1`);
    }

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_users (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_type TEXT NOT NULL,
        nickname TEXT,
        permissions JSONB,
        salt TEXT NOT NULL,
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_settings (
        setting_type TEXT PRIMARY KEY,
        setting_value JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_meta (
        singleton_key TEXT PRIMARY KEY,
        links JSONB NOT NULL DEFAULT '[]'::jsonb,
        socials JSONB NOT NULL DEFAULT '[]'::jsonb,
        menus JSONB NOT NULL DEFAULT '[]'::jsonb,
        rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
        about JSONB NOT NULL DEFAULT '{}'::jsonb,
        site_info JSONB NOT NULL DEFAULT '{}'::jsonb,
        viewer INTEGER NOT NULL DEFAULT 0,
        visited INTEGER NOT NULL DEFAULT 0,
        categories JSONB NOT NULL DEFAULT '[]'::jsonb,
        total_word_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_viewers (
        date TEXT PRIMARY KEY,
        viewer INTEGER NOT NULL DEFAULT 0,
        visited INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_visits (
        date TEXT NOT NULL,
        pathname TEXT NOT NULL,
        viewer INTEGER NOT NULL DEFAULT 0,
        visited INTEGER NOT NULL DEFAULT 0,
        last_visited_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE,
        PRIMARY KEY (date, pathname)
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_articles (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT,
        top_value INTEGER NOT NULL DEFAULT 0,
        hidden BOOLEAN NOT NULL DEFAULT FALSE,
        private_flag BOOLEAN NOT NULL DEFAULT FALSE,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        viewer INTEGER NOT NULL DEFAULT 0,
        visited INTEGER NOT NULL DEFAULT 0,
        author TEXT,
        password TEXT,
        pathname TEXT,
        copyright TEXT,
        last_visited_time TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_article_tags (
        article_id BIGINT NOT NULL REFERENCES vanblog_articles(id) ON DELETE CASCADE,
        tag_name TEXT NOT NULL,
        PRIMARY KEY (article_id, tag_name)
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_tags (
        name TEXT PRIMARY KEY,
        article_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_drafts (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        author TEXT,
        category TEXT,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_custom_pages (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        page_type TEXT NOT NULL DEFAULT 'file',
        html TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_nav_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        hide BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_nav_tools (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        logo TEXT,
        category_id TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        hide BOOLEAN NOT NULL DEFAULT FALSE,
        use_custom_icon BOOLEAN NOT NULL DEFAULT FALSE,
        custom_icon TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_icons (
        name TEXT PRIMARY KEY,
        icon_type TEXT NOT NULL,
        usage TEXT NOT NULL DEFAULT 'social',
        icon_url TEXT NOT NULL,
        icon_url_dark TEXT,
        preset_icon_type TEXT,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_pipelines (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        event_type TEXT,
        description TEXT,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        deps TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        event_name TEXT NOT NULL,
        script TEXT NOT NULL DEFAULT '',
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_tokens (
        token TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name TEXT,
        expires_in BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_statics (
        sign TEXT PRIMARY KEY,
        static_type TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        file_type TEXT,
        real_path TEXT NOT NULL,
        meta JSONB,
        name TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_categories (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category_type TEXT NOT NULL DEFAULT 'category',
        private_flag BOOLEAN NOT NULL DEFAULT FALSE,
        password TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        meta JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_documents (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        author TEXT,
        parent_id BIGINT,
        library_id BIGINT,
        document_type TEXT NOT NULL DEFAULT 'document',
        path JSONB NOT NULL DEFAULT '[]'::jsonb,
        sort_order INTEGER NOT NULL DEFAULT 0,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_moments (
        id BIGINT PRIMARY KEY,
        content TEXT NOT NULL,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_mindmaps (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        author TEXT,
        description TEXT NOT NULL DEFAULT '',
        viewer INTEGER NOT NULL DEFAULT 0,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_created_at ON vanblog_articles (created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_viewers_created_at ON vanblog_viewers (created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_visits_path_date ON vanblog_visits (pathname, date DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_visits_last_visited ON vanblog_visits (last_visited_time DESC NULLS LAST)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_visits_path_last_seen ON vanblog_visits (pathname, last_visited_time DESC NULLS LAST, date DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_public_list ON vanblog_articles (deleted, hidden, top_value DESC, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_pathname ON vanblog_articles (pathname)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_category ON vanblog_articles (category)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_title_lower ON vanblog_articles (LOWER(title))',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_last_visited ON vanblog_articles (last_visited_time DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_article_tags_name ON vanblog_article_tags (tag_name, article_id)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_tags_hot ON vanblog_tags (article_count DESC, updated_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_categories_sort ON vanblog_categories (sort_order ASC, id ASC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_created_at ON vanblog_drafts (deleted, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_updated_at ON vanblog_drafts (deleted, updated_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_title_lower ON vanblog_drafts (LOWER(title))',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_tags ON vanblog_drafts USING GIN (tags)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_custom_pages_name_lower ON vanblog_custom_pages (LOWER(name))',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_categories_sort ON vanblog_nav_categories (sort_order ASC, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_tools_category_sort ON vanblog_nav_tools (category_id, sort_order ASC, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_icons_usage_created ON vanblog_icons (usage, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_event_name ON vanblog_pipelines (event_name, deleted, enabled)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_created ON vanblog_pipelines (deleted, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_tokens_user_disabled ON vanblog_tokens (user_id, disabled, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_tokens_record_id ON vanblog_tokens (source_record_id)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_type_updated ON vanblog_statics (static_type, updated_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_storage_updated ON vanblog_statics (storage_type, updated_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_title_trgm ON vanblog_articles USING GIN (title gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_content_trgm ON vanblog_articles USING GIN (content gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_title_trgm ON vanblog_drafts USING GIN (title gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_content_trgm ON vanblog_drafts USING GIN (content gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_category_trgm ON vanblog_drafts USING GIN (category gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_custom_pages_name_trgm ON vanblog_custom_pages USING GIN (name gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_custom_pages_path_trgm ON vanblog_custom_pages USING GIN (path gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_categories_name_trgm ON vanblog_nav_categories USING GIN (name gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_tools_name_trgm ON vanblog_nav_tools USING GIN (name gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_tools_desc_trgm ON vanblog_nav_tools USING GIN (description gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_icons_name_trgm ON vanblog_icons USING GIN (name gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_icons_desc_trgm ON vanblog_icons USING GIN (description gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_name_trgm ON vanblog_pipelines USING GIN (name gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_desc_trgm ON vanblog_pipelines USING GIN (description gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_name_trgm ON vanblog_statics USING GIN (name gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_path_trgm ON vanblog_statics USING GIN (real_path gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_documents_title_trgm ON vanblog_documents USING GIN (title gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_documents_content_trgm ON vanblog_documents USING GIN (content gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_documents_tree_active ON vanblog_documents (deleted, library_id, parent_id, sort_order ASC, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_moments_content_trgm ON vanblog_moments USING GIN (content gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_moments_active_created ON vanblog_moments (deleted, created_at DESC)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_mindmaps_title_trgm ON vanblog_mindmaps USING GIN (title gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_mindmaps_desc_trgm ON vanblog_mindmaps USING GIN (description gin_trgm_ops)',
    );
    await this.store.query(
      'CREATE INDEX IF NOT EXISTS idx_vanblog_mindmaps_active_updated ON vanblog_mindmaps (deleted, updated_at DESC)',
    );
    // Full-text queries already work without dedicated expression indexes.
    // We defer these until the search vectors are materialized into columns,
    // which avoids PostgreSQL immutability limits during bootstrap.
  }

  private asDate(value: any) {
    if (!value) {
      return new Date().toISOString();
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  }

  private dedupeRecords<T>(
    records: T[],
    label: string,
    getKey: (record: T) => string | null | undefined,
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
      this.logger.warn(`检测到重复${label}，已按最新记录覆盖旧记录: ${(records || []).length - deduped.size} 条`);
    }
    return Array.from(deduped.values());
  }

  private normalizeNumericId(value: any) {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  private mapUserRow(row: any) {
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

  private mapSettingRow(row: any) {
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

  private mapMetaRow(row: any) {
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

  private mapViewerRow(row: any) {
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

  private mapVisitRow(row: any) {
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

  private mapArticleRow(row: any) {
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

  private mapTagRow(row: any) {
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

  private mapDraftRow(row: any) {
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

  private mapCustomPageRow(row: any) {
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

  private mapNavCategoryRow(row: any) {
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

  private mapNavToolRow(row: any) {
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

  private mapIconRow(row: any) {
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

  private mapPipelineRow(row: any) {
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

  private mapTokenRow(row: any) {
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

  private mapStaticRow(row: any) {
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

  private mapCategoryRow(row: any) {
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

  private mapDocumentRow(row: any) {
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

  private mapMomentRow(row: any) {
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

  private mapMindMapRow(row: any) {
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

  private getArticleSelectSql() {
    return `
      SELECT
        a.id,
        a.title,
        a.content,
        a.category,
        a.top_value,
        a.hidden,
        a.private_flag,
        a.deleted,
        a.viewer,
        a.visited,
        a.author,
        a.password,
        a.pathname,
        a.copyright,
        a.last_visited_time,
        a.created_at,
        a.updated_at,
        a.source_record_id,
        COALESCE(
          (
            SELECT array_agg(t.tag_name ORDER BY t.tag_name)
            FROM vanblog_article_tags t
            WHERE t.article_id = a.id
          ),
          ARRAY[]::text[]
        ) AS tags
      FROM vanblog_articles a
    `;
  }

  private getArticleSummarySelectSql() {
    return `
      SELECT
        a.id,
        a.title,
        ''::text AS content,
        a.category,
        a.top_value,
        a.hidden,
        a.private_flag,
        a.deleted,
        a.viewer,
        a.visited,
        a.author,
        NULL::text AS password,
        a.pathname,
        a.copyright,
        a.last_visited_time,
        a.created_at,
        a.updated_at,
        a.source_record_id,
        COALESCE(
          (
            SELECT array_agg(t.tag_name ORDER BY t.tag_name)
            FROM vanblog_article_tags t
            WHERE t.article_id = a.id
          ),
          ARRAY[]::text[]
        ) AS tags
      FROM vanblog_articles a
    `;
  }

  private getTsQuerySql(paramRef: string) {
    return `websearch_to_tsquery('simple', ${paramRef})`;
  }

  private buildWeightedSearchVectorSql(parts: Array<{ expr: string; weight: 'A' | 'B' | 'C' | 'D' }>) {
    return parts
      .map(
        (part) =>
          `setweight(to_tsvector('simple', COALESCE(${part.expr}, '')), '${part.weight}')`,
      )
      .join(' || ');
  }

  private getArticleSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return this.buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}category`, weight: 'B' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

  private getDraftSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return this.buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}category`, weight: 'B' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `array_to_string(${prefix}tags, ' ')`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

  private getDocumentSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return this.buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

  private getMomentSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return this.buildWeightedSearchVectorSql([{ expr: `${prefix}content`, weight: 'A' }]);
  }

  private getMindMapSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return this.buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}description`, weight: 'B' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

  private buildArticleWhere(filters: {
    includeHidden?: boolean;
    includeDelete?: boolean;
    category?: string;
    tags?: string;
    title?: string;
    regMatch?: boolean;
    startTime?: string;
    endTime?: string;
    author?: string;
  }) {
    const params: any[] = [];
    const clauses: string[] = [];
    const regMatch = filters.regMatch !== false;

    if (!filters.includeDelete) {
      clauses.push('a.deleted = FALSE');
    }
    if (!filters.includeHidden) {
      clauses.push('a.hidden = FALSE');
    }
    if (filters.category) {
      params.push(regMatch ? `%${filters.category}%` : filters.category);
      clauses.push(`a.category ${regMatch ? 'ILIKE' : '='} $${params.length}`);
    }
    if (filters.title) {
      params.push(`%${filters.title}%`);
      clauses.push(`a.title ILIKE $${params.length}`);
    }
    if (filters.author) {
      params.push(regMatch ? `%${filters.author}%` : filters.author);
      clauses.push(`a.author ${regMatch ? 'ILIKE' : '='} $${params.length}`);
    }
    if (filters.tags) {
      const tagList = filters.tags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (tagList.length) {
        if (regMatch) {
          const tagClauses = tagList.map((tag) => {
            params.push(`%${tag}%`);
            return `t.tag_name ILIKE $${params.length}`;
          });
          clauses.push(`
            EXISTS (
              SELECT 1
              FROM vanblog_article_tags t
              WHERE t.article_id = a.id
                AND (${tagClauses.join(' OR ')})
            )
          `);
        } else {
          params.push(tagList);
          clauses.push(`
            EXISTS (
              SELECT 1
              FROM vanblog_article_tags t
              WHERE t.article_id = a.id
                AND t.tag_name = ANY($${params.length}::text[])
            )
          `);
        }
      }
    }
    if (filters.startTime) {
      params.push(new Date(filters.startTime));
      clauses.push(`a.created_at >= $${params.length}`);
    }
    if (filters.endTime) {
      params.push(new Date(filters.endTime));
      clauses.push(`a.created_at <= $${params.length}`);
    }

    return {
      params,
      whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    };
  }

  private buildArticleOrderSql(option: SearchArticleOption, isPublic: boolean) {
    let baseOrder = 'a.created_at DESC';
    if (option.sortViewer) {
      baseOrder = `a.viewer ${option.sortViewer === 'asc' ? 'ASC' : 'DESC'}, a.created_at DESC`;
    } else if (option.sortCreatedAt === 'asc') {
      baseOrder = 'a.created_at ASC';
    } else if (option.sortTop) {
      baseOrder = `a.top_value ${option.sortTop === 'asc' ? 'ASC' : 'DESC'}, a.created_at DESC`;
    }

    if (isPublic) {
      return `
        CASE WHEN a.top_value > 0 THEN 0 ELSE 1 END ASC,
        CASE WHEN a.top_value > 0 THEN a.top_value END DESC NULLS LAST,
        ${baseOrder}
      `;
    }

    return baseOrder;
  }

  private async replaceArticleTags(articleId: number, tags: string[] = []) {
    await this.store.query('DELETE FROM vanblog_article_tags WHERE article_id = $1', [articleId]);
    for (const tag of [...new Set((tags || []).map((item) => item?.trim()).filter(Boolean))]) {
      await this.store.query(
        'INSERT INTO vanblog_article_tags (article_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [articleId, tag],
      );
    }
  }

  private async rebuildTagAggregates() {
    await this.store.query('TRUNCATE TABLE vanblog_tags');
    await this.store.query(`
      INSERT INTO vanblog_tags (name, article_count, created_at, updated_at)
      SELECT t.tag_name, COUNT(*), NOW(), NOW()
      FROM vanblog_article_tags t
      INNER JOIN vanblog_articles a ON a.id = t.article_id
      WHERE a.deleted = FALSE
      GROUP BY t.tag_name
    `);
  }

  private async replaceUsers(users: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_users RESTART IDENTITY CASCADE');
    for (const user of this.dedupeRecords(
      users,
      '用户 ID',
      (user) => String(this.normalizeNumericId(user?.id) ?? ''),
    )) {
      if (user?.id === undefined || !user?.name) {
        continue;
      }
      const userId = this.normalizeNumericId(user.id);
      if (userId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_users (
            id, name, password, created_at, user_type, nickname, permissions, salt, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        `,
        [
          userId,
          user.name,
          user.password || '',
          this.asDate(user.createdAt),
          user.type || 'admin',
          user.nickname || null,
          JSON.stringify(user.permissions || null),
          user.salt || '',
          user._id || null,
        ],
      );
    }
  }

  private async replaceSettings(settings: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_settings CASCADE');
    for (const setting of this.dedupeRecords(settings, '设置类型', (setting) => setting?.type)) {
      if (!setting?.type) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_settings (
            setting_type, setting_value, created_at, updated_at, source_record_id
          ) VALUES ($1,$2::jsonb,$3,$4,$5)
        `,
        [
          setting.type,
          JSON.stringify(setting.value ?? null),
          this.asDate(setting.createdAt),
          this.asDate(setting.updatedAt),
          setting._id || null,
        ],
      );
    }
  }

  private async replaceMeta(metaRecords: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_meta CASCADE');
    const meta = Array.isArray(metaRecords) && metaRecords.length ? metaRecords[0] : null;
    if (!meta) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_meta (
          singleton_key, links, socials, menus, rewards, about, site_info,
          viewer, visited, categories, total_word_count, created_at, updated_at, source_record_id
        ) VALUES (
          'default', $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb,
          $7, $8, $9::jsonb, $10, $11, $12, $13
        )
      `,
      [
        JSON.stringify(meta.links || []),
        JSON.stringify(meta.socials || []),
        JSON.stringify(meta.menus || []),
        JSON.stringify(meta.rewards || []),
        JSON.stringify(meta.about || {}),
        JSON.stringify(meta.siteInfo || {}),
        meta.viewer || 0,
        meta.visited || 0,
        JSON.stringify(meta.categories || []),
        meta.totalWordCount || 0,
        this.asDate(meta.createdAt),
        this.asDate(meta.updatedAt),
        meta._id || null,
      ],
    );
  }

  private async replaceViewers(viewers: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_viewers CASCADE');
    for (const viewer of this.dedupeRecords(viewers, '浏览统计日期', (viewer) => viewer?.date)) {
      if (!viewer?.date) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_viewers (
            date, viewer, visited, created_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5)
        `,
        [
          viewer.date,
          viewer.viewer || 0,
          viewer.visited || 0,
          this.asDate(viewer.createdAt),
          viewer._id || null,
        ],
      );
    }
  }

  private async replaceVisits(visits: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_visits CASCADE');
    for (const visit of this.dedupeRecords(
      visits,
      '访问统计键',
      (visit) => (visit?.date && visit?.pathname ? `${visit.date}::${visit.pathname}` : ''),
    )) {
      if (!visit?.date || !visit?.pathname) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_visits (
            date, pathname, viewer, visited, last_visited_time, created_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          visit.date,
          visit.pathname,
          visit.viewer || 0,
          visit.visited || 0,
          visit.lastVisitedTime ? this.asDate(visit.lastVisitedTime) : null,
          this.asDate(visit.createdAt),
          visit._id || null,
        ],
      );
    }
  }

  private async replaceCategories(categories: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_categories CASCADE');
    for (const category of this.dedupeRecords(
      categories,
      '分类 ID',
      (category) => String(this.normalizeNumericId(category?.id) ?? ''),
    )) {
      if (category?.id === undefined || !category?.name) {
        continue;
      }
      const categoryId = this.normalizeNumericId(category.id);
      if (categoryId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_categories (
            id, name, category_type, private_flag, password, sort_order, meta,
            created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
        `,
        [
          categoryId,
          category.name,
          category.type || 'category',
          Boolean(category.private),
          category.password || null,
          category.sort || 0,
          JSON.stringify(category.meta || null),
          this.asDate(category.createdAt),
          this.asDate(category.updatedAt),
          category._id || null,
        ],
      );
    }
  }

  private async replaceArticles(articles: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_article_tags');
    await this.store.query('TRUNCATE TABLE vanblog_articles CASCADE');
    for (const article of this.dedupeRecords(
      articles,
      '文章 ID',
      (article) => String(this.normalizeNumericId(article?.id) ?? ''),
    )) {
      if (article?.id === undefined || !article?.title) {
        continue;
      }
      const articleId = this.normalizeNumericId(article.id);
      if (articleId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_articles (
            id, title, content, category, top_value, hidden, private_flag, deleted,
            viewer, visited, author, password, pathname, copyright,
            last_visited_time, created_at, updated_at, source_record_id
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14,
            $15,$16,$17,$18
          )
        `,
        [
          articleId,
          article.title,
          article.content || '',
          article.category || null,
          article.top || 0,
          Boolean(article.hidden),
          Boolean(article.private),
          Boolean(article.deleted),
          article.viewer || 0,
          article.visited || 0,
          article.author || null,
          article.password || null,
          article.pathname || null,
          article.copyright || null,
          article.lastVisitedTime ? this.asDate(article.lastVisitedTime) : null,
          this.asDate(article.createdAt),
          this.asDate(article.updatedAt),
          article._id || null,
        ],
      );
      for (const tag of article.tags || []) {
        await this.store.query(
          'INSERT INTO vanblog_article_tags (article_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [articleId, tag],
        );
      }
    }
    await this.rebuildTagAggregates();
  }

  private async replaceDrafts(drafts: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_drafts CASCADE');
    for (const draft of this.dedupeRecords(
      drafts,
      '草稿 ID',
      (draft) => String(this.normalizeNumericId(draft?.id) ?? ''),
    )) {
      if (draft?.id === undefined || !draft?.title) {
        continue;
      }
      const draftId = this.normalizeNumericId(draft.id);
      if (draftId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_drafts (
            id, title, content, tags, author, category, deleted,
            created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4::text[],$5,$6,$7,$8,$9,$10)
        `,
        [
          draftId,
          draft.title,
          draft.content || '',
          (draft.tags || []).filter(Boolean),
          draft.author || null,
          draft.category || null,
          Boolean(draft.deleted),
          this.asDate(draft.createdAt),
          this.asDate(draft.updatedAt),
          draft._id || null,
        ],
      );
    }
  }

  private async replaceCustomPages(customPages: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_custom_pages CASCADE');
    for (const page of this.dedupeRecords(customPages, '自定义页面路径', (page) => page?.path)) {
      if (!page?.path || !page?.name) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_custom_pages (
            path, name, page_type, html, created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          page.path,
          page.name,
          page.type || 'file',
          page.html || '',
          this.asDate(page.createdAt),
          this.asDate(page.updatedAt),
          page._id || null,
        ],
      );
    }
  }

  private async replaceNavCategories(categories: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_nav_categories CASCADE');
    for (const category of this.dedupeRecords(
      categories,
      '导航分类 ID',
      (category) => String(category?._id || category?.id || ''),
    )) {
      const id = String(category?._id || category?.id || '');
      if (!id || !category?.name) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_nav_categories (
            id, name, description, sort_order, hide, created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          id,
          category.name,
          category.description || null,
          category.sort || 0,
          Boolean(category.hide),
          this.asDate(category.createdAt),
          this.asDate(category.updatedAt),
          category._id || null,
        ],
      );
    }
  }

  private async replaceNavTools(tools: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_nav_tools CASCADE');
    for (const tool of this.dedupeRecords(
      tools,
      '导航工具 ID',
      (tool) => String(tool?._id || tool?.id || ''),
    )) {
      const id = String(tool?._id || tool?.id || '');
      if (!id || !tool?.name || !tool?.url || !tool?.categoryId) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_nav_tools (
            id, name, url, logo, category_id, description, sort_order, hide,
            use_custom_icon, custom_icon, created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `,
        [
          id,
          tool.name,
          tool.url,
          tool.logo || null,
          tool.categoryId,
          tool.description || null,
          tool.sort || 0,
          Boolean(tool.hide),
          Boolean(tool.useCustomIcon),
          tool.customIcon || null,
          this.asDate(tool.createdAt),
          this.asDate(tool.updatedAt),
          tool._id || null,
        ],
      );
    }
  }

  private async replaceIcons(icons: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_icons CASCADE');
    for (const icon of this.dedupeRecords(icons, '图标名称', (icon) => icon?.name)) {
      if (!icon?.name || !icon?.type || !icon?.iconUrl) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_icons (
            name, icon_type, usage, icon_url, icon_url_dark, preset_icon_type, description,
            created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          icon.name,
          icon.type,
          icon.usage || 'social',
          icon.iconUrl,
          icon.iconUrlDark || null,
          icon.presetIconType || null,
          icon.description || null,
          this.asDate(icon.createdAt),
          this.asDate(icon.updatedAt),
          icon._id || null,
        ],
      );
    }
  }

  private async replacePipelines(pipelines: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_pipelines CASCADE');
    for (const pipeline of this.dedupeRecords(
      pipelines,
      '流水线 ID',
      (pipeline) => String(this.normalizeNumericId(pipeline?.id) ?? ''),
    )) {
      if (pipeline?.id === undefined || !pipeline?.name || !pipeline?.eventName) {
        continue;
      }
      const pipelineId = this.normalizeNumericId(pipeline.id);
      if (pipelineId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_pipelines (
            id, name, event_type, description, enabled, deps, event_name,
            script, deleted, created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11,$12)
        `,
        [
          pipelineId,
          pipeline.name,
          pipeline.eventType || null,
          pipeline.description || null,
          Boolean(pipeline.enabled),
          (pipeline.deps || []).filter(Boolean),
          pipeline.eventName,
          pipeline.script || '',
          Boolean(pipeline.deleted),
          this.asDate(pipeline.createdAt),
          this.asDate(pipeline.updatedAt),
          pipeline._id || null,
        ],
      );
    }
  }

  private async replaceTokens(tokens: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_tokens CASCADE');
    for (const token of this.dedupeRecords(tokens, 'Token', (token) => token?.token)) {
      if (!token?.token) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_tokens (
            token, user_id, name, expires_in, created_at, disabled, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT (token) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            name = EXCLUDED.name,
            expires_in = EXCLUDED.expires_in,
            created_at = EXCLUDED.created_at,
            disabled = EXCLUDED.disabled,
            source_record_id = EXCLUDED.source_record_id
        `,
        [
          token.token,
          token.userId || 0,
          token.name || null,
          token.expiresIn || 0,
          this.asDate(token.createdAt),
          Boolean(token.disabled),
          token._id || null,
        ],
      );
    }
  }

  private async replaceStatics(items: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_statics CASCADE');
    for (const item of this.dedupeRecords(items, '静态资源 sign', (item) => item?.sign)) {
      if (!item?.sign || !item?.realPath || !item?.name) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_statics (
            sign, static_type, storage_type, file_type, real_path, meta, name, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
        `,
        [
          item.sign,
          item.staticType || 'img',
          item.storageType || 'local',
          item.fileType || null,
          item.realPath,
          JSON.stringify(item.meta ?? null),
          item.name,
          this.asDate(item.updatedAt),
          item._id || null,
        ],
      );
    }
  }

  private async replaceDocuments(documents: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_documents CASCADE');
    for (const document of this.dedupeRecords(
      documents,
      '文档 ID',
      (document) => String(this.normalizeNumericId(document?.id) ?? ''),
    )) {
      if (document?.id === undefined || !document?.title) {
        continue;
      }
      const documentId = this.normalizeNumericId(document.id);
      if (documentId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_documents (
            id, title, content, author, parent_id, library_id, document_type,
            path, sort_order, deleted, created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)
        `,
        [
          documentId,
          document.title,
          document.content || '',
          document.author || null,
          document.parent_id ?? null,
          document.library_id ?? null,
          document.type || 'document',
          JSON.stringify(document.path || []),
          document.sort_order || 0,
          Boolean(document.deleted),
          this.asDate(document.createdAt),
          this.asDate(document.updatedAt),
          document._id || null,
        ],
      );
    }
  }

  private async replaceMoments(moments: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_moments CASCADE');
    for (const moment of this.dedupeRecords(
      moments,
      '动态 ID',
      (moment) => String(this.normalizeNumericId(moment?.id) ?? ''),
    )) {
      if (moment?.id === undefined || !moment?.content) {
        continue;
      }
      const momentId = this.normalizeNumericId(moment.id);
      if (momentId === null) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_moments (
            id, content, deleted, created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          momentId,
          moment.content,
          Boolean(moment.deleted),
          this.asDate(moment.createdAt),
          this.asDate(moment.updatedAt),
          moment._id || null,
        ],
      );
    }
  }

  private async replaceMindMaps(mindMaps: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_mindmaps CASCADE');
    for (const mindMap of this.dedupeRecords(
      mindMaps,
      '脑图 ID',
      (mindMap) => String(mindMap?._id || mindMap?.id || ''),
    )) {
      const id = String(mindMap?._id || mindMap?.id || '');
      if (!id || !mindMap?.title) {
        continue;
      }
      await this.store.query(
        `
          INSERT INTO vanblog_mindmaps (
            id, title, content, author, description, viewer, deleted,
            created_at, updated_at, source_record_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          id,
          mindMap.title,
          mindMap.content || '',
          mindMap.author || null,
          mindMap.description || '',
          mindMap.viewer || 0,
          Boolean(mindMap.deleted),
          this.asDate(mindMap.createdAt),
          this.asDate(mindMap.updatedAt),
          mindMap._id || null,
        ],
      );
    }
  }

  async refreshUsersFromRecordStore() {
    const users = await this.store.getAll('users');
    await this.replaceUsers(users);
  }

  async refreshSettingsFromRecordStore() {
    const settings = await this.store.getAll('settings');
    await this.replaceSettings(settings);
  }

  async refreshMetaFromRecordStore() {
    const metaRecords = await this.store.getAll('meta');
    await this.replaceMeta(metaRecords);
  }

  async refreshViewersFromRecordStore() {
    const viewers = await this.store.getAll('viewers');
    await this.replaceViewers(viewers);
  }

  async refreshVisitsFromRecordStore() {
    const visits = await this.store.getAll('visits');
    await this.replaceVisits(visits);
  }

  async refreshCategoriesFromRecordStore() {
    const categories = await this.store.getAll('categories');
    await this.replaceCategories(categories);
  }

  async refreshArticlesFromRecordStore(reason = 'manual') {
    const articles = await this.store.getAll('articles');
    await this.replaceArticles(articles);
    this.logger.log(`文章结构化表同步完成: ${reason}`);
  }

  async refreshDraftsFromRecordStore() {
    const drafts = await this.store.getAll('drafts');
    await this.replaceDrafts(drafts);
  }

  async refreshCustomPagesFromRecordStore() {
    const customPages = await this.store.getAll('custompages');
    await this.replaceCustomPages(customPages);
  }

  async refreshNavCategoriesFromRecordStore() {
    const navCategories = await this.store.getAll('navcategories');
    await this.replaceNavCategories(navCategories);
  }

  async refreshNavToolsFromRecordStore() {
    const navTools = await this.store.getAll('navtools');
    await this.replaceNavTools(navTools);
  }

  async refreshIconsFromRecordStore() {
    const icons = await this.store.getAll('icons');
    await this.replaceIcons(icons);
  }

  async refreshPipelinesFromRecordStore() {
    const pipelines = await this.store.getAll('pipelines');
    await this.replacePipelines(pipelines);
  }

  async refreshTokensFromRecordStore() {
    const tokens = await this.store.getAll('tokens');
    await this.replaceTokens(tokens);
  }

  async refreshStaticsFromRecordStore() {
    const statics = await this.store.getAll('statics');
    await this.replaceStatics(statics);
  }

  async refreshDocumentsFromRecordStore() {
    const documents = await this.store.getAll('documents');
    await this.replaceDocuments(documents);
  }

  async refreshMomentsFromRecordStore() {
    const moments = await this.store.getAll('moments');
    await this.replaceMoments(moments);
  }

  async refreshMindMapsFromRecordStore() {
    const mindMaps = await this.store.getAll('mindmaps');
    await this.replaceMindMaps(mindMaps);
  }

  async refreshCollectionsFromRecordStore(
    collections: Array<
      | 'users'
      | 'settings'
      | 'meta'
      | 'viewers'
      | 'visits'
      | 'categories'
      | 'articles'
      | 'drafts'
      | 'customPages'
      | 'navCategories'
      | 'navTools'
      | 'icons'
      | 'pipelines'
      | 'tokens'
      | 'statics'
      | 'documents'
      | 'moments'
      | 'mindMaps'
    >,
    reason = 'manual',
  ) {
    await this.ensureSchema();

    const refreshers = {
      users: () => this.refreshUsersFromRecordStore(),
      settings: () => this.refreshSettingsFromRecordStore(),
      meta: () => this.refreshMetaFromRecordStore(),
      viewers: () => this.refreshViewersFromRecordStore(),
      visits: () => this.refreshVisitsFromRecordStore(),
      categories: () => this.refreshCategoriesFromRecordStore(),
      articles: () => this.refreshArticlesFromRecordStore(reason),
      drafts: () => this.refreshDraftsFromRecordStore(),
      customPages: () => this.refreshCustomPagesFromRecordStore(),
      navCategories: () => this.refreshNavCategoriesFromRecordStore(),
      navTools: () => this.refreshNavToolsFromRecordStore(),
      icons: () => this.refreshIconsFromRecordStore(),
      pipelines: () => this.refreshPipelinesFromRecordStore(),
      tokens: () => this.refreshTokensFromRecordStore(),
      statics: () => this.refreshStaticsFromRecordStore(),
      documents: () => this.refreshDocumentsFromRecordStore(),
      moments: () => this.refreshMomentsFromRecordStore(),
      mindMaps: () => this.refreshMindMapsFromRecordStore(),
    } as const;

    const uniqueCollections = Array.from(new Set(collections || []));
    for (const collection of uniqueCollections) {
      await refreshers[collection]();
    }

    await this.syncNumericIdSequences();
    this.logger.log(`结构化表定向同步完成: ${reason} (${uniqueCollections.join(', ') || 'none'})`);
  }

  async refreshAllFromRecordStore(reason = 'manual') {
    await this.ensureSchema();
    await this.refreshUsersFromRecordStore();
    await this.refreshSettingsFromRecordStore();
    await this.refreshMetaFromRecordStore();
    await this.refreshViewersFromRecordStore();
    await this.refreshVisitsFromRecordStore();
    await this.refreshCategoriesFromRecordStore();
    await this.refreshArticlesFromRecordStore();
    await this.refreshDraftsFromRecordStore();
    await this.refreshCustomPagesFromRecordStore();
    await this.refreshNavCategoriesFromRecordStore();
    await this.refreshNavToolsFromRecordStore();
    await this.refreshIconsFromRecordStore();
    await this.refreshPipelinesFromRecordStore();
    await this.refreshTokensFromRecordStore();
    await this.refreshStaticsFromRecordStore();
    await this.refreshDocumentsFromRecordStore();
    await this.refreshMomentsFromRecordStore();
    await this.refreshMindMapsFromRecordStore();
    await this.syncNumericIdSequences();
    this.logger.log(`结构化表同步完成: ${reason}`);
  }

  private async syncNumericIdSequences() {
    for (const sequence of this.numericIdSequences) {
      await this.syncSequence(sequence.name, sequence.table, sequence.column);
    }
  }

  private async syncSequence(sequenceName: string, tableName: string, columnName: string) {
    await this.store.query(
      `
        SELECT setval(
          $1::regclass,
          GREATEST(COALESCE((SELECT MAX(${columnName})::bigint FROM ${tableName}), 0), 1),
          COALESCE((SELECT MAX(${columnName}) IS NOT NULL FROM ${tableName}), false)
        )
      `,
      [sequenceName],
    );
  }

  private async reserveNextId(sequenceName: string) {
    const result = await this.store.query<{ next_id: string }>(
      `SELECT nextval($1::regclass)::text AS next_id`,
      [sequenceName],
    );
    return Number(result.rows[0]?.next_id || 1);
  }

  private async ensureSequenceAtLeast(sequenceName: string, numericId: number | string | null | undefined) {
    const parsedId = Number(numericId);
    if (!Number.isFinite(parsedId)) {
      return;
    }
    await this.store.query(
      `
        SELECT setval(
          $1::regclass,
          GREATEST(
            COALESCE((SELECT last_value::bigint FROM pg_sequences WHERE schemaname = current_schema() AND sequencename = $2), 0),
            $3::bigint,
            $4::bigint
          ),
          true
        )
      `,
      [sequenceName, sequenceName, parsedId, 1],
    );
  }

  async nextUserId() {
    return await this.reserveNextId('vanblog_users_id_seq');
  }

  async nextArticleId() {
    return await this.reserveNextId('vanblog_articles_id_seq');
  }

  async nextDraftId() {
    return await this.reserveNextId('vanblog_drafts_id_seq');
  }

  async nextPipelineId() {
    return await this.reserveNextId('vanblog_pipelines_id_seq');
  }

  async nextCategoryId() {
    return await this.reserveNextId('vanblog_categories_id_seq');
  }

  async nextDocumentId() {
    return await this.reserveNextId('vanblog_documents_id_seq');
  }

  async nextMomentId() {
    return await this.reserveNextId('vanblog_moments_id_seq');
  }

  async upsertUser(user: any) {
    if (user?.id === undefined || !user?.name) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_users_id_seq', user.id);
    await this.store.query(
      `
        INSERT INTO vanblog_users (
          id, name, password, created_at, user_type, nickname, permissions, salt, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          password = EXCLUDED.password,
          created_at = EXCLUDED.created_at,
          user_type = EXCLUDED.user_type,
          nickname = EXCLUDED.nickname,
          permissions = EXCLUDED.permissions,
          salt = EXCLUDED.salt,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        user.id,
        user.name,
        user.password || '',
        this.asDate(user.createdAt),
        user.type || 'admin',
        user.nickname || null,
        JSON.stringify(user.permissions || null),
        user.salt || '',
        user._id || null,
      ],
    );
  }

  async deleteUsersExcept(keepIds: number[] = []) {
    if (!keepIds.length) {
      await this.store.query('TRUNCATE TABLE vanblog_users CASCADE');
      return;
    }
    await this.store.query('DELETE FROM vanblog_users WHERE id != ALL($1::bigint[])', [keepIds]);
  }

  async clearStructuredDataForRestore(keepUserIds: number[] = []) {
    const cleanupSql = [
      'TRUNCATE TABLE vanblog_meta CASCADE',
      'TRUNCATE TABLE vanblog_viewers CASCADE',
      'TRUNCATE TABLE vanblog_visits CASCADE',
      'TRUNCATE TABLE vanblog_categories CASCADE',
      'TRUNCATE TABLE vanblog_tags CASCADE',
      'TRUNCATE TABLE vanblog_articles CASCADE',
      'TRUNCATE TABLE vanblog_drafts CASCADE',
      'TRUNCATE TABLE vanblog_custom_pages CASCADE',
      'TRUNCATE TABLE vanblog_nav_categories CASCADE',
      'TRUNCATE TABLE vanblog_nav_tools CASCADE',
      'TRUNCATE TABLE vanblog_icons CASCADE',
      'TRUNCATE TABLE vanblog_pipelines CASCADE',
      'TRUNCATE TABLE vanblog_tokens CASCADE',
      'TRUNCATE TABLE vanblog_statics CASCADE',
      'TRUNCATE TABLE vanblog_documents CASCADE',
      'TRUNCATE TABLE vanblog_moments CASCADE',
      'TRUNCATE TABLE vanblog_mindmaps CASCADE',
      'TRUNCATE TABLE vanblog_settings CASCADE',
    ];

    for (const sql of cleanupSql) {
      await this.store.query(sql);
    }

    await this.deleteUsersExcept(keepUserIds);
  }

  async deleteUserById(id: number) {
    await this.store.query('DELETE FROM vanblog_users WHERE id = $1', [id]);
  }

  async upsertSetting(type: string, value: any, sourceRecordId?: string | null) {
    if (!type) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_settings (
          setting_type, setting_value, created_at, updated_at, source_record_id
        ) VALUES ($1,$2::jsonb,NOW(),NOW(),$3)
        ON CONFLICT (setting_type) DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = NOW(),
          source_record_id = COALESCE(EXCLUDED.source_record_id, vanblog_settings.source_record_id)
      `,
      [type, JSON.stringify(value ?? null), sourceRecordId || null],
    );
  }

  async deleteAllSettings() {
    await this.store.query('TRUNCATE TABLE vanblog_settings CASCADE');
  }

  async upsertMeta(meta: any) {
    if (!meta) {
      await this.store.query('TRUNCATE TABLE vanblog_meta CASCADE');
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_meta (
          singleton_key, links, socials, menus, rewards, about, site_info,
          viewer, visited, categories, total_word_count, created_at, updated_at, source_record_id
        ) VALUES (
          'default', $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb,
          $7, $8, $9::jsonb, $10, $11, $12, $13
        )
        ON CONFLICT (singleton_key) DO UPDATE SET
          links = EXCLUDED.links,
          socials = EXCLUDED.socials,
          menus = EXCLUDED.menus,
          rewards = EXCLUDED.rewards,
          about = EXCLUDED.about,
          site_info = EXCLUDED.site_info,
          viewer = EXCLUDED.viewer,
          visited = EXCLUDED.visited,
          categories = EXCLUDED.categories,
          total_word_count = EXCLUDED.total_word_count,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        JSON.stringify(meta.links || []),
        JSON.stringify(meta.socials || []),
        JSON.stringify(meta.menus || []),
        JSON.stringify(meta.rewards || []),
        JSON.stringify(meta.about || {}),
        JSON.stringify(meta.siteInfo || {}),
        meta.viewer || 0,
        meta.visited || 0,
        JSON.stringify(meta.categories || []),
        meta.totalWordCount || 0,
        this.asDate(meta.createdAt),
        this.asDate(meta.updatedAt),
        meta._id || null,
      ],
    );
  }

  async upsertViewer(viewer: any) {
    if (!viewer?.date) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_viewers (
          date, viewer, visited, created_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (date) DO UPDATE SET
          viewer = EXCLUDED.viewer,
          visited = EXCLUDED.visited,
          created_at = EXCLUDED.created_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        viewer.date,
        viewer.viewer || 0,
        viewer.visited || 0,
        this.asDate(viewer.createdAt),
        viewer._id || null,
      ],
    );
  }

  async getViewerByDate(date: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_viewers
        WHERE date = $1
        LIMIT 1
      `,
      [date],
    );
    return this.mapViewerRow(result.rows[0]);
  }

  async listViewers() {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_viewers
        ORDER BY date ASC
      `,
    );
    return result.rows.map((row) => this.mapViewerRow(row)).filter(Boolean);
  }

  async getViewerSeries(dateFrom: string, dateTo: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_viewers
        WHERE date >= $1 AND date <= $2
        ORDER BY date ASC
      `,
      [dateFrom, dateTo],
    );
    return result.rows.map((row) => this.mapViewerRow(row)).filter(Boolean);
  }

  async upsertVisit(visit: any) {
    if (!visit?.date || !visit?.pathname) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_visits (
          date, pathname, viewer, visited, last_visited_time, created_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (date, pathname) DO UPDATE SET
          viewer = EXCLUDED.viewer,
          visited = EXCLUDED.visited,
          last_visited_time = EXCLUDED.last_visited_time,
          created_at = EXCLUDED.created_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        visit.date,
        visit.pathname,
        visit.viewer || 0,
        visit.visited || 0,
        visit.lastVisitedTime ? this.asDate(visit.lastVisitedTime) : null,
        this.asDate(visit.createdAt),
        visit._id || null,
      ],
    );
  }

  async getVisitByDateAndPath(date: string, pathname: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_visits
        WHERE date = $1 AND pathname = $2
        LIMIT 1
      `,
      [date, pathname],
    );
    return this.mapVisitRow(result.rows[0]);
  }

  async getLastVisitByPath(pathname: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_visits
        WHERE pathname = $1
        ORDER BY date DESC, last_visited_time DESC NULLS LAST
        LIMIT 1
      `,
      [pathname],
    );
    return this.mapVisitRow(result.rows[0]);
  }

  async getLastVisitItem() {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_visits
        WHERE last_visited_time IS NOT NULL
        ORDER BY last_visited_time DESC
        LIMIT 1
      `,
    );
    return this.mapVisitRow(result.rows[0]);
  }

  async listVisits() {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_visits
        ORDER BY date ASC, pathname ASC
      `,
    );
    return result.rows.map((row) => this.mapVisitRow(row)).filter(Boolean);
  }

  async upsertArticle(article: any) {
    if (article?.id === undefined || !article?.title) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_articles_id_seq', article.id);
    await this.store.query(
      `
        INSERT INTO vanblog_articles (
          id, title, content, category, top_value, hidden, private_flag, deleted,
          viewer, visited, author, password, pathname, copyright,
          last_visited_time, created_at, updated_at, source_record_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          category = EXCLUDED.category,
          top_value = EXCLUDED.top_value,
          hidden = EXCLUDED.hidden,
          private_flag = EXCLUDED.private_flag,
          deleted = EXCLUDED.deleted,
          viewer = EXCLUDED.viewer,
          visited = EXCLUDED.visited,
          author = EXCLUDED.author,
          password = EXCLUDED.password,
          pathname = EXCLUDED.pathname,
          copyright = EXCLUDED.copyright,
          last_visited_time = EXCLUDED.last_visited_time,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        article.id,
        article.title,
        article.content || '',
        article.category || null,
        article.top || 0,
        Boolean(article.hidden),
        Boolean(article.private),
        Boolean(article.deleted),
        article.viewer || 0,
        article.visited || 0,
        article.author || null,
        article.password || null,
        article.pathname || null,
        article.copyright || null,
        article.lastVisitedTime ? this.asDate(article.lastVisitedTime) : null,
        this.asDate(article.createdAt),
        this.asDate(article.updatedAt),
        article._id || null,
      ],
    );
    await this.replaceArticleTags(article.id, article.tags || []);
    await this.rebuildTagAggregates();
  }

  async upsertDraft(draft: any) {
    if (draft?.id === undefined || !draft?.title) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_drafts_id_seq', draft.id);
    await this.store.query(
      `
        INSERT INTO vanblog_drafts (
          id, title, content, tags, author, category, deleted,
          created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4::text[],$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          tags = EXCLUDED.tags,
          author = EXCLUDED.author,
          category = EXCLUDED.category,
          deleted = EXCLUDED.deleted,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        draft.id,
        draft.title,
        draft.content || '',
        (draft.tags || []).filter(Boolean),
        draft.author || null,
        draft.category || null,
        Boolean(draft.deleted),
        this.asDate(draft.createdAt),
        this.asDate(draft.updatedAt),
        draft._id || null,
      ],
    );
  }

  async upsertCustomPage(page: any) {
    if (!page?.path || !page?.name) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_custom_pages (
          path, name, page_type, html, created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (path) DO UPDATE SET
          name = EXCLUDED.name,
          page_type = EXCLUDED.page_type,
          html = EXCLUDED.html,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        page.path,
        page.name,
        page.type || 'file',
        page.html || '',
        this.asDate(page.createdAt),
        this.asDate(page.updatedAt),
        page._id || null,
      ],
    );
  }

  async getCustomPageByPath(path: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_custom_pages
        WHERE path = $1
        LIMIT 1
      `,
      [path],
    );
    return this.mapCustomPageRow(result.rows[0]);
  }

  async listCustomPages() {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_custom_pages
        ORDER BY created_at DESC, path ASC
      `,
    );
    return result.rows.map((row) => this.mapCustomPageRow(row)).filter(Boolean);
  }

  async deleteCustomPageByPath(path: string) {
    await this.store.query('DELETE FROM vanblog_custom_pages WHERE path = $1', [path]);
  }

  async upsertNavCategory(category: any) {
    const id = String(category?._id || category?.id || '');
    if (!id || !category?.name) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_nav_categories (
          id, name, description, sort_order, hide, created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order,
          hide = EXCLUDED.hide,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        id,
        category.name,
        category.description || null,
        category.sort || 0,
        Boolean(category.hide),
        this.asDate(category.createdAt),
        this.asDate(category.updatedAt),
        category._id || null,
      ],
    );
  }

  async getNavCategoryById(id: string) {
    const result = await this.store.query(
      `
        SELECT
          c.*,
          COUNT(t.id)::int AS tool_count
        FROM vanblog_nav_categories c
        LEFT JOIN vanblog_nav_tools t ON t.category_id = c.id
        WHERE c.id = $1
        GROUP BY c.id, c.name, c.description, c.sort_order, c.hide, c.created_at, c.updated_at, c.source_record_id
        LIMIT 1
      `,
      [id],
    );
    return this.mapNavCategoryRow(result.rows[0]);
  }

  async getNavCategoryByName(name: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_nav_categories
        WHERE name = $1
        LIMIT 1
      `,
      [name],
    );
    return this.mapNavCategoryRow(result.rows[0]);
  }

  async listNavCategories() {
    const result = await this.store.query(
      `
        SELECT
          c.*,
          COUNT(t.id)::int AS tool_count
        FROM vanblog_nav_categories c
        LEFT JOIN vanblog_nav_tools t ON t.category_id = c.id
        GROUP BY c.id, c.name, c.description, c.sort_order, c.hide, c.created_at, c.updated_at, c.source_record_id
        ORDER BY c.sort_order ASC, c.created_at DESC
      `,
    );
    return result.rows.map((row) => this.mapNavCategoryRow(row)).filter(Boolean);
  }

  async getNavCategoriesPaginated(page: number, pageSize: number) {
    const countResult = await this.store.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM vanblog_nav_categories',
    );
    const result = await this.store.query(
      `
        SELECT
          c.*,
          COUNT(t.id)::int AS tool_count
        FROM vanblog_nav_categories c
        LEFT JOIN vanblog_nav_tools t ON t.category_id = c.id
        GROUP BY c.id, c.name, c.description, c.sort_order, c.hide, c.created_at, c.updated_at, c.source_record_id
        ORDER BY c.sort_order ASC, c.created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, (page - 1) * pageSize],
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      categories: result.rows.map((row) => this.mapNavCategoryRow(row)).filter(Boolean),
    };
  }

  async deleteNavCategoryById(id: string) {
    await this.store.query('DELETE FROM vanblog_nav_categories WHERE id = $1', [id]);
  }

  async updateNavCategorySorts(
    categories: Array<{ id: string; sort: number }>,
    updatedAt = new Date(),
  ) {
    for (const category of categories || []) {
      if (!category?.id) {
        continue;
      }
      await this.store.query(
        `
          UPDATE vanblog_nav_categories
          SET sort_order = $2, updated_at = $3
          WHERE id = $1
        `,
        [category.id, category.sort || 0, this.asDate(updatedAt)],
      );
    }
  }

  async countNavToolsByCategory(categoryId: string) {
    const result = await this.store.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM vanblog_nav_tools
        WHERE category_id = $1
      `,
      [categoryId],
    );
    return Number(result.rows[0]?.total || 0);
  }

  async upsertNavTool(tool: any) {
    const id = String(tool?._id || tool?.id || '');
    if (!id || !tool?.name || !tool?.url || !tool?.categoryId) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_nav_tools (
          id, name, url, logo, category_id, description, sort_order, hide,
          use_custom_icon, custom_icon, created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          url = EXCLUDED.url,
          logo = EXCLUDED.logo,
          category_id = EXCLUDED.category_id,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order,
          hide = EXCLUDED.hide,
          use_custom_icon = EXCLUDED.use_custom_icon,
          custom_icon = EXCLUDED.custom_icon,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        id,
        tool.name,
        tool.url,
        tool.logo || null,
        tool.categoryId,
        tool.description || null,
        tool.sort || 0,
        Boolean(tool.hide),
        Boolean(tool.useCustomIcon),
        tool.customIcon || null,
        this.asDate(tool.createdAt),
        this.asDate(tool.updatedAt),
        tool._id || null,
      ],
    );
  }

  async getNavToolById(id: string) {
    const result = await this.store.query(
      `
        SELECT
          t.*,
          c.name AS category_name
        FROM vanblog_nav_tools t
        LEFT JOIN vanblog_nav_categories c ON c.id = t.category_id
        WHERE t.id = $1
        LIMIT 1
      `,
      [id],
    );
    return this.mapNavToolRow(result.rows[0]);
  }

  async listNavTools() {
    const result = await this.store.query(
      `
        SELECT
          t.*,
          c.name AS category_name
        FROM vanblog_nav_tools t
        LEFT JOIN vanblog_nav_categories c ON c.id = t.category_id
        ORDER BY t.sort_order ASC, t.created_at DESC
      `,
    );
    return result.rows.map((row) => this.mapNavToolRow(row)).filter(Boolean);
  }

  async getNavToolsPaginated(page: number, pageSize: number) {
    const countResult = await this.store.query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM vanblog_nav_tools',
    );
    const result = await this.store.query(
      `
        SELECT
          t.*,
          c.name AS category_name
        FROM vanblog_nav_tools t
        LEFT JOIN vanblog_nav_categories c ON c.id = t.category_id
        ORDER BY t.sort_order ASC, t.created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, (page - 1) * pageSize],
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      tools: result.rows.map((row) => this.mapNavToolRow(row)).filter(Boolean),
    };
  }

  async getNavToolsByCategory(categoryId: string) {
    const result = await this.store.query(
      `
        SELECT
          t.*,
          c.name AS category_name
        FROM vanblog_nav_tools t
        LEFT JOIN vanblog_nav_categories c ON c.id = t.category_id
        WHERE t.category_id = $1
        ORDER BY t.sort_order ASC, t.created_at DESC
      `,
      [categoryId],
    );
    return result.rows.map((row) => this.mapNavToolRow(row)).filter(Boolean);
  }

  async deleteNavToolById(id: string) {
    await this.store.query('DELETE FROM vanblog_nav_tools WHERE id = $1', [id]);
  }

  async updateNavToolSorts(tools: Array<{ id: string; sort: number }>, updatedAt = new Date()) {
    for (const tool of tools || []) {
      if (!tool?.id) {
        continue;
      }
      await this.store.query(
        `
          UPDATE vanblog_nav_tools
          SET sort_order = $2, updated_at = $3
          WHERE id = $1
        `,
        [tool.id, tool.sort || 0, this.asDate(updatedAt)],
      );
    }
  }

  async upsertIcon(icon: any) {
    if (!icon?.name || !icon?.type || !icon?.iconUrl) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_icons (
          name, icon_type, usage, icon_url, icon_url_dark, preset_icon_type, description,
          created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (name) DO UPDATE SET
          icon_type = EXCLUDED.icon_type,
          usage = EXCLUDED.usage,
          icon_url = EXCLUDED.icon_url,
          icon_url_dark = EXCLUDED.icon_url_dark,
          preset_icon_type = EXCLUDED.preset_icon_type,
          description = EXCLUDED.description,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        icon.name,
        icon.type,
        icon.usage || 'social',
        icon.iconUrl,
        icon.iconUrlDark || null,
        icon.presetIconType || null,
        icon.description || null,
        this.asDate(icon.createdAt),
        this.asDate(icon.updatedAt),
        icon._id || null,
      ],
    );
  }

  async getIconByName(name: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_icons
        WHERE name = $1
        LIMIT 1
      `,
      [name],
    );
    return this.mapIconRow(result.rows[0]);
  }

  async listIcons(usage?: 'nav' | 'social') {
    const params: any[] = [];
    const whereSql = usage ? `WHERE usage = $1` : '';
    if (usage) {
      params.push(usage);
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_icons
        ${whereSql}
        ORDER BY created_at DESC, name ASC
      `,
      params,
    );
    return result.rows.map((row) => this.mapIconRow(row)).filter(Boolean);
  }

  async getIconsPaginated(page: number, pageSize: number, usage?: 'nav' | 'social') {
    const params: any[] = [];
    const clauses: string[] = [];
    if (usage) {
      params.push(usage);
      clauses.push(`usage = $${params.length}`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countResult = await this.store.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vanblog_icons ${whereSql}`,
      params,
    );
    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_icons
        ${whereSql}
        ORDER BY created_at DESC, name ASC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `,
      dataParams,
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      icons: result.rows.map((row) => this.mapIconRow(row)).filter(Boolean),
    };
  }

  async deleteIconByName(name: string) {
    await this.store.query('DELETE FROM vanblog_icons WHERE name = $1', [name]);
  }

  async deleteAllIcons() {
    await this.store.query('TRUNCATE TABLE vanblog_icons CASCADE');
  }

  async upsertPipeline(pipeline: any) {
    if (pipeline?.id === undefined || !pipeline?.name || !pipeline?.eventName) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_pipelines_id_seq', pipeline.id);
    await this.store.query(
      `
        INSERT INTO vanblog_pipelines (
          id, name, event_type, description, enabled, deps, event_name,
          script, deleted, created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          event_type = EXCLUDED.event_type,
          description = EXCLUDED.description,
          enabled = EXCLUDED.enabled,
          deps = EXCLUDED.deps,
          event_name = EXCLUDED.event_name,
          script = EXCLUDED.script,
          deleted = EXCLUDED.deleted,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        pipeline.id,
        pipeline.name,
        pipeline.eventType || null,
        pipeline.description || null,
        Boolean(pipeline.enabled),
        (pipeline.deps || []).filter(Boolean),
        pipeline.eventName,
        pipeline.script || '',
        Boolean(pipeline.deleted),
        this.asDate(pipeline.createdAt),
        this.asDate(pipeline.updatedAt),
        pipeline._id || null,
      ],
    );
  }

  async getPipelineById(id: number, includeDeleted = true) {
    const clauses = ['id = $1'];
    if (!includeDeleted) {
      clauses.push('deleted = FALSE');
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_pipelines
        WHERE ${clauses.join(' AND ')}
        LIMIT 1
      `,
      [id],
    );
    return this.mapPipelineRow(result.rows[0]);
  }

  async getMaxPipelineId() {
    const result = await this.store.query<{ max_id: number | null }>(
      `SELECT MAX(id) AS max_id FROM vanblog_pipelines`,
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async listPipelines(includeDeleted = false) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_pipelines
        ${includeDeleted ? '' : 'WHERE deleted = FALSE'}
        ORDER BY created_at DESC, id DESC
      `,
    );
    return result.rows.map((row) => this.mapPipelineRow(row)).filter(Boolean);
  }

  async getPipelinesByEvent(eventName: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_pipelines
        WHERE event_name = $1 AND deleted = FALSE
        ORDER BY created_at DESC, id DESC
      `,
      [eventName],
    );
    return result.rows.map((row) => this.mapPipelineRow(row)).filter(Boolean);
  }

  async deletePipelineById(id: number) {
    await this.store.query(
      `
        UPDATE vanblog_pipelines
        SET deleted = TRUE, updated_at = NOW()
        WHERE id = $1
      `,
      [id],
    );
  }

  async upsertToken(tokenItem: any) {
    if (!tokenItem?.token) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_tokens (
          token, user_id, name, expires_in, created_at, disabled, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (token) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          expires_in = EXCLUDED.expires_in,
          created_at = EXCLUDED.created_at,
          disabled = EXCLUDED.disabled,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        tokenItem.token,
        tokenItem.userId || 0,
        tokenItem.name || null,
        tokenItem.expiresIn || 0,
        this.asDate(tokenItem.createdAt),
        Boolean(tokenItem.disabled),
        tokenItem._id || null,
      ],
    );
  }

  async listTokens(filters: { userId?: number; disabled?: boolean; name?: string } = {}) {
    const params: any[] = [];
    const clauses: string[] = [];
    if (filters.userId !== undefined) {
      params.push(filters.userId);
      clauses.push(`user_id = $${params.length}`);
    }
    if (filters.disabled !== undefined) {
      params.push(filters.disabled);
      clauses.push(`disabled = $${params.length}`);
    }
    if (filters.name) {
      params.push(filters.name);
      clauses.push(`name = $${params.length}`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_tokens
        ${whereSql}
        ORDER BY created_at DESC
      `,
      params,
    );
    return result.rows.map((row) => this.mapTokenRow(row)).filter(Boolean);
  }

  async getTokenByToken(token: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_tokens
        WHERE token = $1
        LIMIT 1
      `,
      [token],
    );
    return this.mapTokenRow(result.rows[0]);
  }

  async getTokenByRecordId(recordId: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_tokens
        WHERE source_record_id = $1
        LIMIT 1
      `,
      [recordId],
    );
    return this.mapTokenRow(result.rows[0]);
  }

  async updateTokenDisabledByToken(token: string, disabled: boolean) {
    await this.store.query(
      `UPDATE vanblog_tokens SET disabled = $2 WHERE token = $1`,
      [token, disabled],
    );
  }

  async updateTokenDisabledByName(name: string, disabled: boolean) {
    await this.store.query(
      `UPDATE vanblog_tokens SET disabled = $2 WHERE name = $1`,
      [name, disabled],
    );
  }

  async updateTokenDisabledByRecordId(recordId: string, disabled: boolean) {
    await this.store.query(
      `UPDATE vanblog_tokens SET disabled = $2 WHERE source_record_id = $1`,
      [recordId, disabled],
    );
  }

  async updateTokensDisabledByUserFilters(filters: {
    userId?: number;
    userIdNot?: number;
    disabled?: boolean;
  }) {
    const params: any[] = [];
    const clauses: string[] = [];
    if (filters.disabled !== undefined) {
      params.push(filters.disabled);
      clauses.push(`disabled = $${params.length}`);
    }
    if (filters.userId !== undefined) {
      params.push(filters.userId);
      clauses.push(`user_id = $${params.length}`);
    }
    if (filters.userIdNot !== undefined) {
      params.push(filters.userIdNot);
      clauses.push(`user_id != $${params.length}`);
    }
    if (!clauses.length) {
      return;
    }
    params.push(true);
    await this.store.query(
      `
        UPDATE vanblog_tokens
        SET disabled = $${params.length}
        WHERE ${clauses.join(' AND ')}
      `,
      params,
    );
  }

  async deleteAllTokens() {
    await this.store.query('TRUNCATE TABLE vanblog_tokens CASCADE');
  }

  async upsertStatic(item: any) {
    if (!item?.sign || !item?.realPath || !item?.name) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_statics (
          sign, static_type, storage_type, file_type, real_path, meta, name, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
        ON CONFLICT (sign) DO UPDATE SET
          static_type = EXCLUDED.static_type,
          storage_type = EXCLUDED.storage_type,
          file_type = EXCLUDED.file_type,
          real_path = EXCLUDED.real_path,
          meta = EXCLUDED.meta,
          name = EXCLUDED.name,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        item.sign,
        item.staticType || 'img',
        item.storageType || 'local',
        item.fileType || null,
        item.realPath,
        JSON.stringify(item.meta ?? null),
        item.name,
        this.asDate(item.updatedAt),
        item._id || null,
      ],
    );
  }

  async getStaticBySign(sign: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_statics
        WHERE sign = $1
        LIMIT 1
      `,
      [sign],
    );
    return this.mapStaticRow(result.rows[0]);
  }

  async listStatics(staticType?: string) {
    const params: any[] = [];
    const whereSql = staticType ? 'WHERE static_type = $1' : '';
    if (staticType) {
      params.push(staticType);
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_statics
        ${whereSql}
        ORDER BY updated_at DESC, sign ASC
      `,
      params,
    );
    return result.rows.map((row) => this.mapStaticRow(row)).filter(Boolean);
  }

  async exportStatics() {
    return await this.listStatics();
  }

  async queryStatics(option: {
    staticType?: string;
    page?: number;
    pageSize?: number;
  }) {
    const params: any[] = [];
    const clauses: string[] = [];
    if (option.staticType) {
      params.push(option.staticType);
      clauses.push(`static_type = $${params.length}`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countResult = await this.store.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vanblog_statics ${whereSql}`,
      params,
    );
    const dataParams = [...params];
    let limitSql = '';
    if ((option.pageSize ?? -1) > 0) {
      const safePage = option.page && option.page > 0 ? option.page : 1;
      dataParams.push(option.pageSize);
      dataParams.push((safePage - 1) * option.pageSize);
      limitSql = `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_statics
        ${whereSql}
        ORDER BY updated_at DESC, sign ASC
        ${limitSql}
      `,
      dataParams,
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      items: result.rows.map((row) => this.mapStaticRow(row)).filter(Boolean),
    };
  }

  async deleteStaticBySign(sign: string) {
    await this.store.query('DELETE FROM vanblog_statics WHERE sign = $1', [sign]);
  }

  async deleteAllStatics() {
    await this.store.query('TRUNCATE TABLE vanblog_statics CASCADE');
  }

  async getArticleById(id: number) {
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        WHERE a.id = $1 AND a.deleted = FALSE
        LIMIT 1
      `,
      [id],
    );
    return this.mapArticleRow(result.rows[0]);
  }

  async getArticleByPathname(pathname: string) {
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        WHERE a.pathname = $1 AND a.deleted = FALSE
        LIMIT 1
      `,
      [decodeURIComponent(pathname)],
    );
    return this.mapArticleRow(result.rows[0]);
  }

  async getArticleByTitle(title: string) {
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        WHERE a.title = $1
        ORDER BY a.updated_at DESC
        LIMIT 1
      `,
      [title],
    );
    return this.mapArticleRow(result.rows[0]);
  }

  async getAdjacentArticle(
    article: { id: number; createdAt: Date | string },
    direction: 'prev' | 'next',
    includeHidden = false,
  ) {
    if (!article?.id || !article?.createdAt) {
      return null;
    }
    const comparator = direction === 'prev' ? '<' : '>';
    const orderDirection = direction === 'prev' ? 'DESC' : 'ASC';
    const idComparator = direction === 'prev' ? '<' : '>';
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        WHERE a.deleted = FALSE
          AND ($3::boolean OR a.hidden = FALSE)
          AND (
            a.created_at ${comparator} $1
            OR (a.created_at = $1 AND a.id ${idComparator} $2)
          )
        ORDER BY a.created_at ${orderDirection}, a.id ${orderDirection}
        LIMIT 1
      `,
      [this.asDate(article.createdAt), article.id, includeHidden],
    );
    return this.mapArticleRow(result.rows[0]);
  }

  async getMaxArticleId(maxExclusive = 50000) {
    const result = await this.store.query<{ max_id: number | null }>(
      `
        SELECT MAX(id) AS max_id
        FROM vanblog_articles
        WHERE id < $1
      `,
      [maxExclusive],
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async listArticles(options: {
    includeHidden?: boolean;
    includeDelete?: boolean;
    limit?: number;
    orderBy?: string;
  } = {}) {
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden: options.includeHidden,
      includeDelete: options.includeDelete,
    });
    const orderSql = options.orderBy || 'a.created_at DESC';
    const limitSql =
      options.limit && options.limit > 0 ? `LIMIT ${Math.trunc(options.limit)}` : '';
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        ${whereSql}
        ORDER BY ${orderSql}
        ${limitSql}
      `,
      params,
    );
    return result.rows.map((row) => this.mapArticleRow(row)).filter(Boolean);
  }

  async getRecentVisitedArticles(limit: number) {
    return await this.listArticles({
      includeHidden: true,
      includeDelete: false,
      limit,
      orderBy: 'a.last_visited_time DESC NULLS LAST',
    });
  }

  async getTopViewerArticles(limit: number) {
    return await this.listArticles({
      includeHidden: true,
      includeDelete: false,
      limit,
      orderBy: 'a.viewer DESC, a.created_at DESC',
    });
  }

  async getTopVisitedArticles(limit: number) {
    return await this.listArticles({
      includeHidden: true,
      includeDelete: false,
      limit,
      orderBy: 'a.visited DESC, a.created_at DESC',
    });
  }

  async getAnalysisViewerSnapshot(limit: number) {
    const safeLimit = Math.max(1, Math.trunc(limit || 1));
    const articleSummarySql = this.getArticleSummarySelectSql();
    const result = await this.store.query(
      `
        SELECT
          COALESCE(
            (
              SELECT json_agg(row_to_json(top_viewer_rows))
              FROM (
                ${articleSummarySql}
                WHERE a.deleted = FALSE
                ORDER BY a.viewer DESC, a.created_at DESC
                LIMIT $1
              ) AS top_viewer_rows
            ),
            '[]'::json
          ) AS top_viewer,
          COALESCE(
            (
              SELECT json_agg(row_to_json(top_visited_rows))
              FROM (
                ${articleSummarySql}
                WHERE a.deleted = FALSE
                ORDER BY a.visited DESC, a.created_at DESC
                LIMIT $1
              ) AS top_visited_rows
            ),
            '[]'::json
          ) AS top_visited,
          COALESCE(
            (
              SELECT json_agg(row_to_json(recent_visit_rows))
              FROM (
                ${articleSummarySql}
                WHERE a.deleted = FALSE
                ORDER BY a.last_visited_time DESC NULLS LAST, a.created_at DESC
                LIMIT $1
              ) AS recent_visit_rows
            ),
            '[]'::json
          ) AS recent_visit_articles,
          (
            SELECT row_to_json(last_visit_row)
            FROM (
              SELECT pathname, last_visited_time
              FROM vanblog_visits
              WHERE last_visited_time IS NOT NULL
              ORDER BY last_visited_time DESC
              LIMIT 1
            ) AS last_visit_row
          ) AS last_visit,
          COALESCE(
            (
              SELECT json_agg(row_to_json(top_path_rows))
              FROM (
                SELECT
                  latest_paths.pathname,
                  latest_paths.viewer,
                  latest_paths.visited,
                  latest_paths.last_visited_time
                FROM (
                  SELECT DISTINCT ON (pathname)
                    pathname,
                    viewer,
                    visited,
                    last_visited_time
                  FROM vanblog_visits
                  ORDER BY pathname, date DESC, last_visited_time DESC NULLS LAST
                ) AS latest_paths
                ORDER BY latest_paths.visited DESC, latest_paths.viewer DESC, latest_paths.pathname ASC
                LIMIT $1
              ) AS top_path_rows
            ),
            '[]'::json
          ) AS top_paths,
          COALESCE(
            (
              SELECT json_agg(row_to_json(recent_path_rows))
              FROM (
                SELECT
                  latest_paths.pathname,
                  latest_paths.viewer,
                  latest_paths.visited,
                  latest_paths.last_visited_time
                FROM (
                  SELECT DISTINCT ON (pathname)
                    pathname,
                    viewer,
                    visited,
                    last_visited_time
                  FROM vanblog_visits
                  WHERE last_visited_time IS NOT NULL
                  ORDER BY pathname, last_visited_time DESC NULLS LAST, date DESC
                ) AS latest_paths
                ORDER BY latest_paths.last_visited_time DESC NULLS LAST, latest_paths.pathname ASC
                LIMIT $1
              ) AS recent_path_rows
            ),
            '[]'::json
          ) AS recent_paths,
          (
            SELECT row_to_json(meta_row)
            FROM (
              SELECT viewer, visited
              FROM vanblog_meta
              WHERE singleton_key = 'default'
              LIMIT 1
            ) AS meta_row
          ) AS total_stats
      `,
      [safeLimit],
    );
    const row: any = result.rows[0] || {};
    const topViewer = Array.isArray(row.top_viewer)
      ? row.top_viewer.map((item: any) => this.mapArticleRow(item)).filter(Boolean)
      : [];
    const topVisited = Array.isArray(row.top_visited)
      ? row.top_visited.map((item: any) => this.mapArticleRow(item)).filter(Boolean)
      : [];
    const recentVisitArticles = Array.isArray(row.recent_visit_articles)
      ? row.recent_visit_articles.map((item: any) => this.mapArticleRow(item)).filter(Boolean)
      : [];
    const totalStats = row.total_stats || {};
    const lastVisit = row.last_visit || {};

    return {
      topViewer,
      topVisited,
      recentVisitArticles,
      topVisitedPaths: Array.isArray(row.top_paths)
        ? row.top_paths.map((item: any) => ({
            pathname: item.pathname,
            viewer: Number(item.viewer || 0),
            visited: Number(item.visited || 0),
            lastVisitedTime: item.last_visited_time || null,
          }))
        : [],
      recentVisitedPaths: Array.isArray(row.recent_paths)
        ? row.recent_paths.map((item: any) => ({
            pathname: item.pathname,
            viewer: Number(item.viewer || 0),
            visited: Number(item.visited || 0),
            lastVisitedTime: item.last_visited_time || null,
          }))
        : [],
      siteLastVisitedTime: lastVisit.last_visited_time || null,
      siteLastVisitedPathname: lastVisit.pathname || '',
      totalViewer: Number(totalStats.viewer || 0),
      totalVisited: Number(totalStats.visited || 0),
      maxArticleViewer: Number(topViewer[0]?.viewer || 0),
      maxArticleVisited: Number(topVisited[0]?.visited || 0),
    };
  }

  async getAnalysisArticleSnapshot(limit: number) {
    const safeLimit = Math.max(1, Math.trunc(limit || 1));
    const result = await this.store.query(
      `
        SELECT
          (
            SELECT COUNT(*)::int
            FROM vanblog_articles
            WHERE deleted = FALSE
          ) AS article_num,
          (
            SELECT COALESCE(total_word_count, 0)::int
            FROM vanblog_meta
            WHERE singleton_key = 'default'
            LIMIT 1
          ) AS word_num,
          (
            SELECT COUNT(*)::int
            FROM vanblog_tags
          ) AS tag_num,
          (
            SELECT COUNT(*)::int
            FROM vanblog_categories
          ) AS category_num,
          COALESCE(
            (
              SELECT json_agg(row_to_json(category_rows))
              FROM (
                SELECT
                  c.name AS type,
                  COUNT(a.id)::int AS value
                FROM vanblog_categories c
                LEFT JOIN vanblog_articles a
                  ON a.category = c.name
                 AND a.deleted = FALSE
                GROUP BY c.id, c.name, c.sort_order
                ORDER BY c.sort_order ASC, c.id ASC
              ) AS category_rows
            ),
            '[]'::json
          ) AS category_pie_data,
          COALESCE(
            (
              SELECT json_agg(row_to_json(tag_rows))
              FROM (
                SELECT
                  name AS type,
                  article_count AS value
                FROM vanblog_tags
                ORDER BY article_count DESC, updated_at DESC, name ASC
                LIMIT $1
              ) AS tag_rows
            ),
            '[]'::json
          ) AS column_data
      `,
      [safeLimit],
    );
    const row: any = result.rows[0] || {};
    return {
      articleNum: Number(row.article_num || 0),
      wordNum: Number(row.word_num || 0),
      tagNum: Number(row.tag_num || 0),
      categoryNum: Number(row.category_num || 0),
      categoryPieData: Array.isArray(row.category_pie_data) ? row.category_pie_data : [],
      columnData: Array.isArray(row.column_data) ? row.column_data : [],
    };
  }

  async getTotalArticles(includeHidden: boolean) {
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden,
      includeDelete: false,
    });
    const result = await this.store.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM vanblog_articles a
        ${whereSql}
      `,
      params,
    );
    return Number(result.rows[0]?.total || 0);
  }

  async getTimelineSummary(includeHidden: boolean) {
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden,
      includeDelete: false,
    });
    const result = await this.store.query(
      `
        SELECT
          EXTRACT(YEAR FROM a.created_at)::int AS year,
          COUNT(*)::int AS article_count
        FROM vanblog_articles a
        ${whereSql}
        GROUP BY EXTRACT(YEAR FROM a.created_at)
        ORDER BY year DESC
      `,
      params,
    );
    return result.rows.map((row: any) => ({
      year: String(row.year),
      articleCount: Number(row.article_count || 0),
    }));
  }

  async getArchiveSummary(
    includeHidden: boolean,
    filter?: {
      category?: string;
      tag?: string;
    },
  ) {
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden,
      includeDelete: false,
      category: filter?.category,
      tags: filter?.tag,
      regMatch: false,
    });
    const result = await this.store.query(
      `
        SELECT
          EXTRACT(YEAR FROM a.created_at)::int AS year,
          EXTRACT(MONTH FROM a.created_at)::int AS month,
          COUNT(*)::int AS article_count,
          MAX(COALESCE(a.updated_at, a.created_at)) AS last_modified
        FROM vanblog_articles a
        ${whereSql}
        GROUP BY EXTRACT(YEAR FROM a.created_at), EXTRACT(MONTH FROM a.created_at)
        ORDER BY year DESC, month DESC
      `,
      params,
    );

    const years: Array<{
      year: string;
      articleCount: number;
      months: Array<{
        month: string;
        articleCount: number;
      }>;
    }> = [];
    const yearMap = new Map<string, (typeof years)[number]>();
    let latestTimestamp: string | null = null;
    let totalArticles = 0;

    for (const row of result.rows as any[]) {
      const year = String(row.year);
      const month = String(row.month).padStart(2, '0');
      const articleCount = Number(row.article_count || 0);
      totalArticles += articleCount;

      if (!yearMap.has(year)) {
        const payload = {
          year,
          articleCount: 0,
          months: [],
        };
        yearMap.set(year, payload);
        years.push(payload);
      }

      const yearEntry = yearMap.get(year);
      yearEntry.articleCount += articleCount;
      yearEntry.months.push({
        month,
        articleCount,
      });

      const rowTimestamp = row.last_modified ? new Date(row.last_modified).getTime() : NaN;
      const currentLatest = latestTimestamp ? new Date(latestTimestamp).getTime() : NaN;
      if (!Number.isNaN(rowTimestamp) && (Number.isNaN(currentLatest) || rowTimestamp > currentLatest)) {
        latestTimestamp = new Date(rowTimestamp).toISOString();
      }
    }

    return {
      totalArticles,
      years,
      latestTimestamp,
    };
  }

  async getArchiveMonthArticles(
    year: string,
    month: string,
    includeHidden: boolean,
    filter?: {
      category?: string;
      tag?: string;
    },
  ) {
    const numericYear = parseInt(year, 10);
    const numericMonth = parseInt(month, 10);
    if (
      Number.isNaN(numericYear) ||
      Number.isNaN(numericMonth) ||
      numericMonth < 1 ||
      numericMonth > 12
    ) {
      return {
        articles: [],
        latestTimestamp: null,
      };
    }

    const start = new Date(Date.UTC(numericYear, numericMonth - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(numericYear, numericMonth, 1, 0, 0, 0, 0));

    const result = await this.queryArticles(
      {
        page: 1,
        pageSize: -1,
        regMatch: false,
        startTime: start.toISOString(),
        endTime: new Date(end.getTime() - 1).toISOString(),
        category: filter?.category,
        tags: filter?.tag,
        toListView: true,
      },
      !includeHidden,
    );

    const latestTimestamp = result.articles
      .map((article: any) => new Date(article.updatedAt || article.createdAt).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((left, right) => right - left)[0];

    return {
      articles: result.articles,
      latestTimestamp: latestTimestamp ? new Date(latestTimestamp).toISOString() : null,
    };
  }

  async getTimelineArticlesGrouped(includeHidden: boolean) {
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden,
      includeDelete: false,
    });
    const result = await this.store.query(
      `
        SELECT
          timeline_articles.year,
          json_agg(row_to_json(timeline_articles) ORDER BY timeline_articles.created_at DESC) AS articles
        FROM (
          SELECT
            EXTRACT(YEAR FROM a.created_at)::int AS year,
            a.id,
            a.title,
            a.content,
            a.category,
            a.top_value,
            a.hidden,
            a.private_flag,
            a.deleted,
            a.viewer,
            a.visited,
            a.author,
            a.password,
            a.pathname,
            a.copyright,
            a.last_visited_time,
            a.created_at,
            a.updated_at,
            a.source_record_id,
            COALESCE(
              (
                SELECT array_agg(t.tag_name ORDER BY t.tag_name)
                FROM vanblog_article_tags t
                WHERE t.article_id = a.id
              ),
              ARRAY[]::text[]
            ) AS tags
          FROM vanblog_articles a
          ${whereSql}
        ) AS timeline_articles
        GROUP BY timeline_articles.year
        ORDER BY timeline_articles.year DESC
      `,
      params,
    );

    return result.rows.reduce<Record<string, any[]>>((acc, row: any) => {
      acc[String(row.year)] = (row.articles || []).map((article: any) => this.mapArticleRow(article));
      return acc;
    }, {});
  }

  async queryArticles(option: SearchArticleOption, isPublic: boolean) {
    const normalizedOption: SearchArticleOption = {
      ...option,
      page: option.page || 1,
      pageSize: option.pageSize ?? -1,
      regMatch: option.regMatch !== false,
    };
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden: !isPublic,
      includeDelete: false,
      category: normalizedOption.category,
      tags: normalizedOption.tags,
      title: normalizedOption.title,
      regMatch: normalizedOption.regMatch,
      startTime: normalizedOption.startTime,
      endTime: normalizedOption.endTime,
      author: normalizedOption.author,
    });
    const countResult = await this.store.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM vanblog_articles a
        ${whereSql}
      `,
      params,
    );

    const queryParams = [...params];
    let limitSql = '';
    if (normalizedOption.pageSize !== -1) {
      queryParams.push(normalizedOption.pageSize);
      queryParams.push(normalizedOption.pageSize * (normalizedOption.page - 1));
      limitSql = `LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
    }

    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        ${whereSql}
        ORDER BY ${this.buildArticleOrderSql(normalizedOption, isPublic)}
        ${limitSql}
      `,
      queryParams,
    );

    return {
      total: Number(countResult.rows[0]?.total || 0),
      articles: result.rows.map((row) => this.mapArticleRow(row)).filter(Boolean),
    };
  }

  async getTagByName(name: string) {
    const result = await this.store.query(
      `
        SELECT name, article_count, created_at, updated_at
        FROM vanblog_tags
        WHERE name = $1
        LIMIT 1
      `,
      [name],
    );
    return this.mapTagRow(result.rows[0]);
  }

  async listTagNames() {
    const result = await this.store.query<{ name: string }>(
      `
        SELECT name
        FROM vanblog_tags
        ORDER BY name ASC
      `,
    );
    return result.rows.map((row) => row.name);
  }

  async listTagRecords() {
    const result = await this.store.query(
      `
        SELECT name, article_count, created_at, updated_at
        FROM vanblog_tags
        ORDER BY name ASC
      `,
    );
    return result.rows.map((row) => this.mapTagRow(row)).filter(Boolean);
  }

  private async refreshTagAggregates(tagNames: string[]) {
    const normalizedNames = [...new Set((tagNames || []).map((item) => item?.trim()).filter(Boolean))];
    if (!normalizedNames.length) {
      return;
    }
    await this.store.query(`DELETE FROM vanblog_tags WHERE name = ANY($1::text[])`, [normalizedNames]);
    await this.store.query(
      `
        INSERT INTO vanblog_tags (name, article_count, created_at, updated_at)
        SELECT t.tag_name, COUNT(*)::int, NOW(), NOW()
        FROM vanblog_article_tags t
        INNER JOIN vanblog_articles a ON a.id = t.article_id
        WHERE a.deleted = FALSE
          AND t.tag_name = ANY($1::text[])
        GROUP BY t.tag_name
      `,
      [normalizedNames],
    );
  }

  async renameTagInArticles(oldName: string, newName: string) {
    if (!oldName || !newName || oldName === newName) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_article_tags (article_id, tag_name)
        SELECT article_id, $2
        FROM vanblog_article_tags
        WHERE tag_name = $1
        ON CONFLICT DO NOTHING
      `,
      [oldName, newName],
    );
    await this.store.query('DELETE FROM vanblog_article_tags WHERE tag_name = $1', [oldName]);
    await this.refreshTagAggregates([oldName, newName]);
  }

  async removeTagFromArticles(name: string) {
    if (!name) {
      return;
    }
    await this.store.query('DELETE FROM vanblog_article_tags WHERE tag_name = $1', [name]);
    await this.store.query('DELETE FROM vanblog_tags WHERE name = $1', [name]);
  }

  async getTagPage(
    page: number,
    pageSize: number,
    sortBy: 'name' | 'articleCount' | 'createdAt' | 'updatedAt',
    sortOrder: 'asc' | 'desc',
    search?: string,
  ) {
    const params: any[] = [];
    const clauses: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      clauses.push(`name ILIKE $${params.length}`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderColumns: Record<string, string> = {
      name: 'name',
      articleCount: 'article_count',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const orderColumn = orderColumns[sortBy] || 'article_count';
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const countResult = await this.store.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM vanblog_tags
        ${whereSql}
      `,
      params,
    );

    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const result = await this.store.query(
      `
        SELECT name, article_count, created_at, updated_at
        FROM vanblog_tags
        ${whereSql}
        ORDER BY ${orderColumn} ${direction}, name ASC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `,
      dataParams,
    );

    return {
      tags: result.rows.map((row) => this.mapTagRow(row)).filter(Boolean),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async getHotTags(limit: number) {
    const result = await this.store.query(
      `
        SELECT name, article_count, created_at, updated_at
        FROM vanblog_tags
        ORDER BY article_count DESC, updated_at DESC, name ASC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows.map((row) => this.mapTagRow(row)).filter(Boolean);
  }

  async searchTags(keyword: string, limit: number) {
    const result = await this.store.query(
      `
        SELECT name, article_count, created_at, updated_at
        FROM vanblog_tags
        WHERE name ILIKE $1
        ORDER BY article_count DESC, name ASC
        LIMIT $2
      `,
      [`%${keyword}%`, limit],
    );
    return result.rows.map((row) => this.mapTagRow(row)).filter(Boolean);
  }

  async searchArticles(keyword: string, includeHidden: boolean, limit = 200) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return [];
    }
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden,
      includeDelete: false,
    });
    const keywordParamIndex = params.length + 1;
    const limitParamIndex = params.length + 2;
    const tsQuerySql = this.getTsQuerySql(`$${keywordParamIndex}`);
    const searchVectorSql = this.getArticleSearchVectorSql('a');
    const fuzzyScoreSql = `
      GREATEST(
        similarity(COALESCE(a.title, ''), $${keywordParamIndex}),
        similarity(COALESCE(a.content, ''), $${keywordParamIndex}),
        similarity(COALESCE(a.category, ''), $${keywordParamIndex}),
        similarity(COALESCE(a.author, ''), $${keywordParamIndex})
      )
    `;
    const queryParams = [...params, normalizedKeyword, limit];
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        ${whereSql ? `${whereSql} AND` : 'WHERE'}
        (
          ${searchVectorSql} @@ ${tsQuerySql}
          OR a.title ILIKE '%' || $${keywordParamIndex} || '%'
          OR a.content ILIKE '%' || $${keywordParamIndex} || '%'
          OR COALESCE(a.category, '') ILIKE '%' || $${keywordParamIndex} || '%'
          OR COALESCE(a.author, '') ILIKE '%' || $${keywordParamIndex} || '%'
          OR EXISTS (
            SELECT 1
            FROM vanblog_article_tags t
            WHERE t.article_id = a.id
              AND t.tag_name ILIKE '%' || $${keywordParamIndex} || '%'
          )
        )
        ORDER BY
          ts_rank_cd(${searchVectorSql}, ${tsQuerySql}) DESC,
          ${fuzzyScoreSql} DESC,
          a.top_value DESC,
          a.created_at DESC
        LIMIT $${limitParamIndex}
      `,
      queryParams,
    );
    return result.rows.map((row) => this.mapArticleRow(row)).filter(Boolean);
  }

  async getDraftById(id: number, includeDeleted = false) {
    const params: any[] = [id];
    const clauses = ['id = $1'];
    if (!includeDeleted) {
      clauses.push('deleted = FALSE');
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_drafts
        WHERE ${clauses.join(' AND ')}
        LIMIT 1
      `,
      params,
    );
    return this.mapDraftRow(result.rows[0]);
  }

  async findDraftByTitle(title: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_drafts
        WHERE title = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [title],
    );
    return this.mapDraftRow(result.rows[0]);
  }

  async getMaxDraftId() {
    const result = await this.store.query<{ max_id: number | null }>(
      `
        SELECT MAX(id) AS max_id
        FROM vanblog_drafts
      `,
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async listDrafts(includeDeleted = false) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_drafts
        ${includeDeleted ? '' : 'WHERE deleted = FALSE'}
        ORDER BY created_at DESC, id DESC
      `,
    );
    return result.rows.map((row) => this.mapDraftRow(row)).filter(Boolean);
  }

  async queryDrafts(option: {
    page?: number;
    pageSize?: number;
    category?: string;
    tags?: string;
    title?: string;
    sortCreatedAt?: 'asc' | 'desc';
    startTime?: string;
    endTime?: string;
  }) {
    const params: any[] = [];
    const clauses: string[] = ['deleted = FALSE'];

    if (option.tags) {
      const tags = option.tags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (tags.length) {
        const tagClauses = tags.map((tag) => {
          params.push(`%${tag}%`);
          return `tag ILIKE $${params.length}`;
        });
        clauses.push(`
          EXISTS (
            SELECT 1
            FROM unnest(tags) AS tag
            WHERE ${tagClauses.join(' OR ')}
          )
        `);
      }
    }

    if (option.category) {
      params.push(`%${option.category}%`);
      clauses.push(`COALESCE(category, '') ILIKE $${params.length}`);
    }

    if (option.title) {
      params.push(`%${option.title}%`);
      clauses.push(`title ILIKE $${params.length}`);
    }

    if (option.startTime) {
      params.push(new Date(option.startTime));
      clauses.push(`created_at >= $${params.length}`);
    }

    if (option.endTime) {
      params.push(new Date(option.endTime));
      clauses.push(`created_at <= $${params.length}`);
    }

    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const countResult = await this.store.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM vanblog_drafts
        ${whereSql}
      `,
      params,
    );

    const dataParams = [...params];
    let limitSql = '';
    if ((option.pageSize ?? -1) > 0) {
      const safePage = option.page && option.page > 0 ? option.page : 1;
      dataParams.push(option.pageSize);
      dataParams.push((safePage - 1) * option.pageSize);
      limitSql = `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    }

    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_drafts
        ${whereSql}
        ORDER BY created_at ${option.sortCreatedAt === 'asc' ? 'ASC' : 'DESC'}, id DESC
        ${limitSql}
      `,
      dataParams,
    );

    return {
      total: Number(countResult.rows[0]?.total || 0),
      drafts: result.rows.map((row) => this.mapDraftRow(row)).filter(Boolean),
    };
  }

  async searchDrafts(keyword: string, limit = 200) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return [];
    }
    const searchVectorSql = this.getDraftSearchVectorSql();
    const tsQuerySql = this.getTsQuerySql('$1');
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_drafts
        WHERE deleted = FALSE
          AND (
            ${searchVectorSql} @@ ${tsQuerySql}
            OR title ILIKE '%' || $1 || '%'
            OR content ILIKE '%' || $1 || '%'
            OR COALESCE(category, '') ILIKE '%' || $1 || '%'
            OR COALESCE(author, '') ILIKE '%' || $1 || '%'
            OR EXISTS (
              SELECT 1
              FROM unnest(tags) AS tag
              WHERE tag ILIKE '%' || $1 || '%'
            )
          )
        ORDER BY
          ts_rank_cd(${searchVectorSql}, ${tsQuerySql}) DESC,
          GREATEST(
            similarity(COALESCE(title, ''), $1),
            similarity(COALESCE(content, ''), $1),
            similarity(COALESCE(category, ''), $1),
            similarity(COALESCE(author, ''), $1)
          ) DESC,
          created_at DESC
        LIMIT $2
      `,
      [normalizedKeyword, limit],
    );
    return result.rows.map((row) => this.mapDraftRow(row)).filter(Boolean);
  }

  async upsertDocument(document: any) {
    if (document?.id === undefined || !document?.title) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_documents_id_seq', document.id);
    await this.store.query(
      `
        INSERT INTO vanblog_documents (
          id, title, content, author, parent_id, library_id, document_type,
          path, sort_order, deleted, created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          author = EXCLUDED.author,
          parent_id = EXCLUDED.parent_id,
          library_id = EXCLUDED.library_id,
          document_type = EXCLUDED.document_type,
          path = EXCLUDED.path,
          sort_order = EXCLUDED.sort_order,
          deleted = EXCLUDED.deleted,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        document.id,
        document.title,
        document.content || '',
        document.author || null,
        document.parent_id ?? null,
        document.library_id ?? null,
        document.type || 'document',
        JSON.stringify(document.path || []),
        document.sort_order || 0,
        Boolean(document.deleted),
        this.asDate(document.createdAt),
        this.asDate(document.updatedAt),
        document._id || null,
      ],
    );
  }

  async getDocumentById(id: number) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_documents
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `,
      [id],
    );
    return this.mapDocumentRow(result.rows[0]);
  }

  async getDocumentsByIds(ids: number[]) {
    if (!ids.length) {
      return [];
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_documents
        WHERE id = ANY($1::bigint[]) AND deleted = FALSE
        ORDER BY sort_order ASC, created_at DESC
      `,
      [ids],
    );
    return result.rows.map((row) => this.mapDocumentRow(row)).filter(Boolean);
  }

  async getDocumentSubtree(rootId: number, includeDeleted = false) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_documents
        WHERE (
          id = $1
          OR path @> to_jsonb(ARRAY[$1]::bigint[])
        )
        ${includeDeleted ? '' : 'AND deleted = FALSE'}
        ORDER BY jsonb_array_length(path) ASC, sort_order ASC, created_at DESC
      `,
      [rootId],
    );
    return result.rows.map((row) => this.mapDocumentRow(row)).filter(Boolean);
  }

  async markDocumentsDeleted(ids: number[], updatedAt = new Date()) {
    if (!ids.length) {
      return;
    }
    await this.store.query(
      `
        UPDATE vanblog_documents
        SET deleted = TRUE, updated_at = $2
        WHERE id = ANY($1::bigint[])
      `,
      [ids, this.asDate(updatedAt)],
    );
  }

  async getMaxDocumentId() {
    const result = await this.store.query<{ max_id: number | null }>(
      `
        SELECT MAX(id) AS max_id
        FROM vanblog_documents
      `,
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async queryDocuments(option: {
    page?: number;
    pageSize?: number;
    title?: string;
    library_id?: number;
    parent_id?: number;
    type?: 'library' | 'document';
    author?: string;
    sortCreatedAt?: 'asc' | 'desc';
    startTime?: string;
    endTime?: string;
  }) {
    const params: any[] = [];
    const clauses: string[] = ['deleted = FALSE'];
    if (option.title) {
      params.push(`%${option.title}%`);
      clauses.push(`title ILIKE $${params.length}`);
    }
    if (option.library_id !== undefined) {
      params.push(option.library_id);
      clauses.push(`library_id = $${params.length}`);
    }
    if (option.parent_id !== undefined) {
      params.push(option.parent_id);
      clauses.push(`parent_id = $${params.length}`);
    }
    if (option.type) {
      params.push(option.type);
      clauses.push(`document_type = $${params.length}`);
    }
    if (option.author) {
      params.push(`%${option.author}%`);
      clauses.push(`author ILIKE $${params.length}`);
    }
    if (option.startTime) {
      params.push(new Date(option.startTime));
      clauses.push(`created_at >= $${params.length}`);
    }
    if (option.endTime) {
      params.push(new Date(option.endTime));
      clauses.push(`created_at <= $${params.length}`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countResult = await this.store.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vanblog_documents ${whereSql}`,
      params,
    );
    const dataParams = [...params];
    let limitSql = '';
    if ((option.pageSize ?? -1) > 0) {
      const safePage = option.page && option.page > 0 ? option.page : 1;
      dataParams.push(option.pageSize);
      dataParams.push((safePage - 1) * option.pageSize);
      limitSql = `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_documents
        ${whereSql}
        ORDER BY sort_order ASC, created_at ${option.sortCreatedAt === 'asc' ? 'ASC' : 'DESC'}
        ${limitSql}
      `,
      dataParams,
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      documents: result.rows.map((row) => this.mapDocumentRow(row)).filter(Boolean),
    };
  }

  async listDocuments(options: {
    includeDelete?: boolean;
    libraryId?: number;
    type?: 'library' | 'document';
  } = {}) {
    const params: any[] = [];
    const clauses: string[] = [];
    if (!options.includeDelete) {
      clauses.push('deleted = FALSE');
    }
    if (options.libraryId !== undefined) {
      params.push(options.libraryId);
      clauses.push(`library_id = $${params.length}`);
    }
    if (options.type) {
      params.push(options.type);
      clauses.push(`document_type = $${params.length}`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_documents
        ${whereSql}
        ORDER BY sort_order ASC, created_at DESC
      `,
      params,
    );
    return result.rows.map((row) => this.mapDocumentRow(row)).filter(Boolean);
  }

  async searchDocuments(keyword: string) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return [];
    }
    const searchVectorSql = this.getDocumentSearchVectorSql();
    const tsQuerySql = this.getTsQuerySql('$1');
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_documents
        WHERE deleted = FALSE
          AND (
            ${searchVectorSql} @@ ${tsQuerySql}
            OR title ILIKE '%' || $1 || '%'
            OR content ILIKE '%' || $1 || '%'
            OR COALESCE(author, '') ILIKE '%' || $1 || '%'
          )
        ORDER BY
          ts_rank_cd(${searchVectorSql}, ${tsQuerySql}) DESC,
          GREATEST(
            similarity(COALESCE(title, ''), $1),
            similarity(COALESCE(content, ''), $1),
            similarity(COALESCE(author, ''), $1)
          ) DESC,
          created_at DESC
      `,
      [normalizedKeyword],
    );
    return result.rows.map((row) => this.mapDocumentRow(row)).filter(Boolean);
  }

  async upsertMoment(moment: any) {
    if (moment?.id === undefined || !moment?.content) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_moments_id_seq', moment.id);
    await this.store.query(
      `
        INSERT INTO vanblog_moments (
          id, content, deleted, created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          deleted = EXCLUDED.deleted,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        moment.id,
        moment.content,
        Boolean(moment.deleted),
        this.asDate(moment.createdAt),
        this.asDate(moment.updatedAt),
        moment._id || null,
      ],
    );
  }

  async getMaxMomentId() {
    const result = await this.store.query<{ max_id: number | null }>(
      `SELECT MAX(id) AS max_id FROM vanblog_moments`,
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async queryMoments(option: {
    page?: number;
    pageSize?: number;
    sortCreatedAt?: 'asc' | 'desc';
    startTime?: string;
    endTime?: string;
  }) {
    const params: any[] = [];
    const clauses: string[] = ['deleted = FALSE'];
    if (option.startTime) {
      params.push(new Date(option.startTime));
      clauses.push(`created_at >= $${params.length}`);
    }
    if (option.endTime) {
      params.push(new Date(option.endTime));
      clauses.push(`created_at <= $${params.length}`);
    }
    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const countResult = await this.store.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vanblog_moments ${whereSql}`,
      params,
    );
    const dataParams = [...params];
    let limitSql = '';
    if ((option.pageSize ?? -1) > 0) {
      const safePage = option.page && option.page > 0 ? option.page : 1;
      dataParams.push(option.pageSize);
      dataParams.push((safePage - 1) * option.pageSize);
      limitSql = `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_moments
        ${whereSql}
        ORDER BY created_at ${option.sortCreatedAt === 'asc' ? 'ASC' : 'DESC'}
        ${limitSql}
      `,
      dataParams,
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      moments: result.rows.map((row) => this.mapMomentRow(row)).filter(Boolean),
    };
  }

  async getMomentById(id: number) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_moments
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `,
      [id],
    );
    return this.mapMomentRow(result.rows[0]);
  }

  async getTotalMoments() {
    const result = await this.store.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vanblog_moments WHERE deleted = FALSE`,
    );
    return Number(result.rows[0]?.total || 0);
  }

  async searchMoments(keyword: string, limit = 50) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return [];
    }
    const searchVectorSql = this.getMomentSearchVectorSql();
    const tsQuerySql = this.getTsQuerySql('$1');
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_moments
        WHERE deleted = FALSE
          AND (
            ${searchVectorSql} @@ ${tsQuerySql}
            OR content ILIKE '%' || $1 || '%'
          )
        ORDER BY
          ts_rank_cd(${searchVectorSql}, ${tsQuerySql}) DESC,
          similarity(COALESCE(content, ''), $1) DESC,
          created_at DESC
        LIMIT $2
      `,
      [normalizedKeyword, limit],
    );
    return result.rows.map((row) => this.mapMomentRow(row)).filter(Boolean);
  }

  async upsertMindMap(mindMap: any) {
    const id = String(mindMap?._id || mindMap?.id || '');
    if (!id || !mindMap?.title) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_mindmaps (
          id, title, content, author, description, viewer, deleted,
          created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          author = EXCLUDED.author,
          description = EXCLUDED.description,
          viewer = EXCLUDED.viewer,
          deleted = EXCLUDED.deleted,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        id,
        mindMap.title,
        mindMap.content || '',
        mindMap.author || null,
        mindMap.description || '',
        mindMap.viewer || 0,
        Boolean(mindMap.deleted),
        this.asDate(mindMap.createdAt),
        this.asDate(mindMap.updatedAt),
        mindMap._id || null,
      ],
    );
  }

  async queryMindMaps(option: {
    page?: number;
    pageSize?: number;
    title?: string;
    author?: string;
    sortCreatedAt?: 'asc' | 'desc';
    startTime?: string;
    endTime?: string;
  }) {
    const params: any[] = [];
    const clauses: string[] = ['deleted = FALSE'];
    if (option.title) {
      params.push(`%${option.title}%`);
      clauses.push(`title ILIKE $${params.length}`);
    }
    if (option.author) {
      params.push(option.author);
      clauses.push(`author = $${params.length}`);
    }
    const timeColumn = option.sortCreatedAt ? 'created_at' : 'updated_at';
    if (option.startTime) {
      params.push(new Date(option.startTime));
      clauses.push(`${timeColumn} >= $${params.length}`);
    }
    if (option.endTime) {
      params.push(new Date(option.endTime));
      clauses.push(`${timeColumn} <= $${params.length}`);
    }
    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const countResult = await this.store.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM vanblog_mindmaps ${whereSql}`,
      params,
    );
    const dataParams = [...params];
    let limitSql = '';
    if ((option.pageSize ?? -1) > 0) {
      const safePage = option.page && option.page > 0 ? option.page : 1;
      dataParams.push(option.pageSize);
      dataParams.push((safePage - 1) * option.pageSize);
      limitSql = `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_mindmaps
        ${whereSql}
        ORDER BY ${option.sortCreatedAt ? 'created_at' : 'updated_at'} ${
        option.sortCreatedAt === 'asc' ? 'ASC' : 'DESC'
      }
        ${limitSql}
      `,
      dataParams,
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      mindMaps: result.rows.map((row) => this.mapMindMapRow(row)).filter(Boolean),
    };
  }

  async getMindMapById(id: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_mindmaps
        WHERE id = $1 AND deleted = FALSE
        LIMIT 1
      `,
      [id],
    );
    return this.mapMindMapRow(result.rows[0]);
  }

  async searchMindMaps(keyword: string, limit = 50) {
    const normalizedKeyword = keyword?.trim();
    if (!normalizedKeyword) {
      return [];
    }
    const searchVectorSql = this.getMindMapSearchVectorSql();
    const tsQuerySql = this.getTsQuerySql('$1');
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_mindmaps
        WHERE deleted = FALSE
          AND (
            ${searchVectorSql} @@ ${tsQuerySql}
            OR title ILIKE '%' || $1 || '%'
            OR description ILIKE '%' || $1 || '%'
            OR content ILIKE '%' || $1 || '%'
            OR COALESCE(author, '') ILIKE '%' || $1 || '%'
          )
        ORDER BY
          ts_rank_cd(${searchVectorSql}, ${tsQuerySql}) DESC,
          GREATEST(
            similarity(COALESCE(title, ''), $1),
            similarity(COALESCE(description, ''), $1),
            similarity(COALESCE(author, ''), $1)
          ) DESC,
          updated_at DESC
        LIMIT $2
      `,
      [normalizedKeyword, limit],
    );
    return result.rows.map((row) => this.mapMindMapRow(row)).filter(Boolean);
  }

  async getMeta() {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_meta
        WHERE singleton_key = 'default'
        LIMIT 1
      `,
    );
    return this.mapMetaRow(result.rows[0]);
  }

  async upsertCategory(category: any) {
    if (category?.id === undefined || !category?.name) {
      return;
    }
    await this.ensureSequenceAtLeast('vanblog_categories_id_seq', category.id);
    await this.store.query(
      `
        INSERT INTO vanblog_categories (
          id, name, category_type, private_flag, password, sort_order, meta,
          created_at, updated_at, source_record_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category_type = EXCLUDED.category_type,
          private_flag = EXCLUDED.private_flag,
          password = EXCLUDED.password,
          sort_order = EXCLUDED.sort_order,
          meta = EXCLUDED.meta,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      [
        category.id,
        category.name,
        category.type || 'category',
        Boolean(category.private),
        category.password || null,
        category.sort || 0,
        JSON.stringify(category.meta || null),
        this.asDate(category.createdAt),
        this.asDate(category.updatedAt),
        category._id || null,
      ],
    );
  }

  async listCategories() {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_categories
        ORDER BY sort_order ASC, id ASC
      `,
    );
    return result.rows.map((row) => this.mapCategoryRow(row)).filter(Boolean);
  }

  async getCategoryByName(name: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_categories
        WHERE name = $1
        LIMIT 1
      `,
      [name],
    );
    return this.mapCategoryRow(result.rows[0]);
  }

  async getCategoriesByNames(names: string[]) {
    const normalizedNames = [...new Set((names || []).map((item) => item?.trim()).filter(Boolean))];
    if (!normalizedNames.length) {
      return [];
    }
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_categories
        WHERE name = ANY($1::text[])
        ORDER BY sort_order ASC, id ASC
      `,
      [normalizedNames],
    );
    return result.rows.map((row) => this.mapCategoryRow(row)).filter(Boolean);
  }

  async getMaxCategoryId() {
    const result = await this.store.query<{ max_id: number | null }>(
      `SELECT MAX(id) AS max_id FROM vanblog_categories`,
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async deleteCategoryByName(name: string) {
    await this.store.query('DELETE FROM vanblog_categories WHERE name = $1', [name]);
  }

  async getCategoryArticleSummaries(includeHidden: boolean) {
    const result = await this.store.query(
      `
        SELECT
          c.name,
          COUNT(a.id)::int AS article_count
        FROM vanblog_categories c
        LEFT JOIN vanblog_articles a
          ON a.category = c.name
         AND a.deleted = FALSE
         AND ($1::boolean OR a.hidden = FALSE)
        GROUP BY c.id, c.name, c.sort_order
        ORDER BY c.sort_order ASC, c.id ASC
      `,
      [includeHidden],
    );
    return result.rows.map((row: any) => ({
      name: row.name,
      articleCount: Number(row.article_count || 0),
    }));
  }

  async getCategoryDistribution(includeHidden: boolean) {
    const result = await this.store.query(
      `
        SELECT
          c.name AS type,
          COUNT(a.id)::int AS value
        FROM vanblog_categories c
        LEFT JOIN vanblog_articles a
          ON a.category = c.name
         AND a.deleted = FALSE
         AND ($1::boolean OR a.hidden = FALSE)
        GROUP BY c.id, c.name, c.sort_order
        ORDER BY c.sort_order ASC, c.id ASC
      `,
      [includeHidden],
    );
    return result.rows.map((row: any) => ({
      type: row.type,
      value: Number(row.value || 0),
    }));
  }

  async getArticlesByCategory(name: string, includeHidden: boolean) {
    const { params, whereSql } = this.buildArticleWhere({
      includeHidden,
      includeDelete: false,
      category: name,
      regMatch: false,
    });
    const result = await this.store.query(
      `
        ${this.getArticleSelectSql()}
        ${whereSql}
        ORDER BY a.created_at DESC
      `,
      params,
    );
    return result.rows.map((row) => this.mapArticleRow(row)).filter(Boolean);
  }

  async listMindMaps(includeDelete = false) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_mindmaps
        ${includeDelete ? '' : 'WHERE deleted = FALSE'}
        ORDER BY updated_at DESC
      `,
    );
    return result.rows.map((row) => this.mapMindMapRow(row)).filter(Boolean);
  }

  async getUserById(id: number) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_users
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );
    return this.mapUserRow(result.rows[0]);
  }

  async getUserByName(name: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_users
        WHERE name = $1
        LIMIT 1
      `,
      [name],
    );
    return this.mapUserRow(result.rows[0]);
  }

  async getUsersByType(type: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_users
        WHERE user_type = $1
        ORDER BY id ASC
      `,
      [type],
    );
    return result.rows.map((row) => this.mapUserRow(row)).filter(Boolean);
  }

  async listUsers() {
    const result = await this.store.query(`
      SELECT *
      FROM vanblog_users
      ORDER BY id ASC
    `);
    return result.rows.map((row) => this.mapUserRow(row)).filter(Boolean);
  }

  async getMaxUserId() {
    const result = await this.store.query<{ max_id: number | null }>(
      `
        SELECT MAX(id) AS max_id
        FROM vanblog_users
      `,
    );
    const value = result.rows[0]?.max_id;
    return value === null || value === undefined ? null : Number(value);
  }

  async getSetting(type: string) {
    const result = await this.store.query(
      `
        SELECT *
        FROM vanblog_settings
        WHERE setting_type = $1
        LIMIT 1
      `,
      [type],
    );
    return this.mapSettingRow(result.rows[0]);
  }

  async listSettings() {
    const result = await this.store.query(`
      SELECT *
      FROM vanblog_settings
      ORDER BY setting_type ASC
    `);
    return result.rows.map((row) => this.mapSettingRow(row)).filter(Boolean);
  }

  isInitialized() {
    return this.initialized;
  }
}
