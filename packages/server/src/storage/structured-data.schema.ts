import { PostgresStoreService } from './postgres-store.service';
import { getArticleSearchVectorValueSql } from './structured-data.sql';

export const NUMERIC_ID_SEQUENCES = [
  { name: 'vanblog_users_id_seq', table: 'vanblog_users', column: 'id' },
  { name: 'vanblog_articles_id_seq', table: 'vanblog_articles', column: 'id' },
  { name: 'vanblog_drafts_id_seq', table: 'vanblog_drafts', column: 'id' },
  { name: 'vanblog_pipelines_id_seq', table: 'vanblog_pipelines', column: 'id' },
  { name: 'vanblog_categories_id_seq', table: 'vanblog_categories', column: 'id' },
  { name: 'vanblog_documents_id_seq', table: 'vanblog_documents', column: 'id' },
  { name: 'vanblog_moments_id_seq', table: 'vanblog_moments', column: 'id' },
  { name: 'vanblog_comments_id_seq', table: 'vanblog_comments', column: 'id' },
] as const;

async function ensureCommentSchema(store: PostgresStoreService) {
  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_comments (
        id BIGINT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        parent_id BIGINT,
        root_id BIGINT,
        reply_to_nick TEXT,
        nick TEXT NOT NULL DEFAULT '',
        mail TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        likes INTEGER NOT NULL DEFAULT 0,
        ip TEXT NOT NULL DEFAULT '',
        ua TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        browser TEXT NOT NULL DEFAULT '',
        os TEXT NOT NULL DEFAULT '',
        images TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT
      )
    `);
  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_comment_likes (
        comment_id BIGINT NOT NULL,
        actor_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT,
        PRIMARY KEY (comment_id, actor_hash)
      )
    `);
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_thread ON vanblog_comments (target_type, target_id, status, root_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_status_created ON vanblog_comments (status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_root ON vanblog_comments (root_id)',
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_parent ON vanblog_comments (parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_created ON vanblog_comments (created_at DESC, id DESC)',
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_content_trgm ON vanblog_comments USING GIN (content gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_vanblog_comments_nick_trgm ON vanblog_comments USING GIN (nick gin_trgm_ops)',
  ];
  for (const sql of indexes) {
    await store.query(sql);
  }
}

export async function ensureStructuredDataSchema(store: PostgresStoreService) {
  await store.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  for (const sequence of NUMERIC_ID_SEQUENCES) {
    await store.query(`CREATE SEQUENCE IF NOT EXISTS ${sequence.name} START WITH 1 INCREMENT BY 1`);
  }

  await store.query(`
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

  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_settings (
        setting_type TEXT PRIMARY KEY,
        setting_value JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

  await store.query(`
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

  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_viewers (
        date TEXT PRIMARY KEY,
        viewer INTEGER NOT NULL DEFAULT 0,
        visited INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

  await store.query(`
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

  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_articles (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT,
        categories TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        categories_text TEXT NOT NULL DEFAULT '',
        search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector,
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

  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_article_tags (
        article_id BIGINT NOT NULL REFERENCES vanblog_articles(id) ON DELETE CASCADE,
        tag_name TEXT NOT NULL,
        PRIMARY KEY (article_id, tag_name)
      )
    `);

  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_tags (
        name TEXT PRIMARY KEY,
        article_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
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

  await store.query(`
      CREATE TABLE IF NOT EXISTS vanblog_moments (
        id BIGINT PRIMARY KEY,
        content TEXT NOT NULL,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source_record_id TEXT UNIQUE
      )
    `);

  await store.query(`
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

  await ensureCommentSchema(store);

  await store.query(
    `ALTER TABLE vanblog_articles ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT ARRAY[]::text[]`,
  );
  await store.query(
    `ALTER TABLE vanblog_articles ADD COLUMN IF NOT EXISTS categories_text TEXT NOT NULL DEFAULT ''`,
  );
  await store.query(
    `ALTER TABLE vanblog_articles ADD COLUMN IF NOT EXISTS search_vector TSVECTOR NOT NULL DEFAULT ''::tsvector`,
  );
  await store.query(
    `UPDATE vanblog_articles SET categories = ARRAY[category]::text[] WHERE category IS NOT NULL AND category <> '' AND cardinality(categories) = 0`,
  );
  await store.query(`
      UPDATE vanblog_articles
      SET
        categories_text = array_to_string(categories, ' '),
        search_vector = ${getArticleSearchVectorValueSql({
          title: 'title',
          categories: 'categories',
          category: 'category',
          author: 'author',
          content: 'content',
        })}
      WHERE
        categories_text IS DISTINCT FROM array_to_string(categories, ' ')
        OR search_vector IS DISTINCT FROM ${getArticleSearchVectorValueSql({
          title: 'title',
          categories: 'categories',
          category: 'category',
          author: 'author',
          content: 'content',
        })}
    `);
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_created_at ON vanblog_articles (created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_viewers_created_at ON vanblog_viewers (created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_visits_path_date ON vanblog_visits (pathname, date DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_visits_last_visited ON vanblog_visits (last_visited_time DESC NULLS LAST)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_visits_path_last_seen ON vanblog_visits (pathname, last_visited_time DESC NULLS LAST, date DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_public_list ON vanblog_articles (deleted, hidden, top_value DESC, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_pathname ON vanblog_articles (pathname)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_category ON vanblog_articles (category)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_categories ON vanblog_articles USING GIN (categories)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_title_lower ON vanblog_articles (LOWER(title))',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_last_visited ON vanblog_articles (last_visited_time DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_article_tags_name ON vanblog_article_tags (tag_name, article_id)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_tags_hot ON vanblog_tags (article_count DESC, updated_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_categories_sort ON vanblog_categories (sort_order ASC, id ASC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_created_at ON vanblog_drafts (deleted, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_updated_at ON vanblog_drafts (deleted, updated_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_title_lower ON vanblog_drafts (LOWER(title))',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_tags ON vanblog_drafts USING GIN (tags)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_custom_pages_name_lower ON vanblog_custom_pages (LOWER(name))',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_categories_sort ON vanblog_nav_categories (sort_order ASC, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_tools_category_sort ON vanblog_nav_tools (category_id, sort_order ASC, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_icons_usage_created ON vanblog_icons (usage, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_event_name ON vanblog_pipelines (event_name, deleted, enabled)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_created ON vanblog_pipelines (deleted, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_tokens_user_disabled ON vanblog_tokens (user_id, disabled, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_tokens_record_id ON vanblog_tokens (source_record_id)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_type_updated ON vanblog_statics (static_type, updated_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_storage_updated ON vanblog_statics (storage_type, updated_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_title_trgm ON vanblog_articles USING GIN (title gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_content_trgm ON vanblog_articles USING GIN (content gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_search_vector ON vanblog_articles USING GIN (search_vector)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_category_trgm ON vanblog_articles USING GIN (category gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_categories_text_trgm ON vanblog_articles USING GIN (categories_text gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_articles_author_trgm ON vanblog_articles USING GIN (author gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_article_tags_name_trgm ON vanblog_article_tags USING GIN (tag_name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_title_trgm ON vanblog_drafts USING GIN (title gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_content_trgm ON vanblog_drafts USING GIN (content gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_drafts_category_trgm ON vanblog_drafts USING GIN (category gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_custom_pages_name_trgm ON vanblog_custom_pages USING GIN (name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_custom_pages_path_trgm ON vanblog_custom_pages USING GIN (path gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_categories_name_trgm ON vanblog_nav_categories USING GIN (name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_tools_name_trgm ON vanblog_nav_tools USING GIN (name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_nav_tools_desc_trgm ON vanblog_nav_tools USING GIN (description gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_icons_name_trgm ON vanblog_icons USING GIN (name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_icons_desc_trgm ON vanblog_icons USING GIN (description gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_name_trgm ON vanblog_pipelines USING GIN (name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_pipelines_desc_trgm ON vanblog_pipelines USING GIN (description gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_name_trgm ON vanblog_statics USING GIN (name gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_statics_path_trgm ON vanblog_statics USING GIN (real_path gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_documents_title_trgm ON vanblog_documents USING GIN (title gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_documents_content_trgm ON vanblog_documents USING GIN (content gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_documents_tree_active ON vanblog_documents (deleted, library_id, parent_id, sort_order ASC, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_moments_content_trgm ON vanblog_moments USING GIN (content gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_moments_active_created ON vanblog_moments (deleted, created_at DESC)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_mindmaps_title_trgm ON vanblog_mindmaps USING GIN (title gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_mindmaps_desc_trgm ON vanblog_mindmaps USING GIN (description gin_trgm_ops)',
  );
  await store.query(
    'CREATE INDEX IF NOT EXISTS idx_vanblog_mindmaps_active_updated ON vanblog_mindmaps (deleted, updated_at DESC)',
  );
  // Full-text queries already work without dedicated expression indexes.
  // We defer these until the search vectors are materialized into columns,
  // which avoids PostgreSQL immutability limits during bootstrap.
}
