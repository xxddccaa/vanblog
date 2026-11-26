import { SearchArticleOption } from 'src/types/article.dto';

export function getArticleSelectSql() {
    return `
      SELECT
        a.id,
        a.title,
        a.content,
        a.category,
        a.categories,
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

export function getArticleSummarySelectSql() {
    return `
      SELECT
        a.id,
        a.title,
        ''::text AS content,
        a.category,
        a.categories,
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

export function getDraftSelectSql() {
    return `
      SELECT
        id,
        title,
        content,
        tags,
        author,
        category,
        deleted,
        created_at,
        updated_at,
        source_record_id
      FROM vanblog_drafts
    `;
  }

export function getDraftSummarySelectSql() {
    return `
      SELECT
        id,
        title,
        ''::text AS content,
        tags,
        author,
        category,
        deleted,
        created_at,
        updated_at,
        source_record_id
      FROM vanblog_drafts
    `;
  }

export function getDocumentSelectSql() {
    return `
      SELECT
        id,
        title,
        content,
        author,
        parent_id,
        library_id,
        document_type,
        path,
        sort_order,
        deleted,
        created_at,
        updated_at,
        source_record_id
      FROM vanblog_documents
    `;
  }

export function getDocumentSummarySelectSql() {
    return `
      SELECT
        id,
        title,
        ''::text AS content,
        author,
        parent_id,
        library_id,
        document_type,
        path,
        sort_order,
        deleted,
        created_at,
        updated_at,
        source_record_id
      FROM vanblog_documents
    `;
  }

export function getCustomPageSelectSql() {
    return `
      SELECT
        path,
        name,
        page_type,
        html,
        created_at,
        updated_at,
        source_record_id
      FROM vanblog_custom_pages
    `;
  }

export function getCustomPageSummarySelectSql() {
    return `
      SELECT
        path,
        name,
        page_type,
        ''::text AS html,
        created_at,
        updated_at,
        source_record_id
      FROM vanblog_custom_pages
    `;
  }

export function getTsQuerySql(paramRef: string) {
    return `websearch_to_tsquery('simple', ${paramRef})`;
  }

export function buildWeightedSearchVectorSql(
    parts: Array<{ expr: string; weight: 'A' | 'B' | 'C' | 'D' }>,
  ) {
    return parts
      .map(
        (part) => `setweight(to_tsvector('simple', COALESCE(${part.expr}, '')), '${part.weight}')`,
      )
      .join(' || ');
  }

export function getArticleSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return `${prefix}search_vector`;
  }

export function getArticleSearchVectorValueSql(fields: {
    title: string;
    categories: string;
    category: string;
    author: string;
    content: string;
  }) {
    return buildWeightedSearchVectorSql([
      { expr: fields.title, weight: 'A' },
      { expr: `array_to_string(${fields.categories}, ' ')`, weight: 'B' },
      { expr: fields.category, weight: 'B' },
      { expr: fields.author, weight: 'C' },
      { expr: fields.content, weight: 'D' },
    ]);
  }

export function getDraftSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}category`, weight: 'B' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `array_to_string(${prefix}tags, ' ')`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

export function getDocumentSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

export function getMomentSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return buildWeightedSearchVectorSql([{ expr: `${prefix}content`, weight: 'A' }]);
  }

export function getMindMapSearchVectorSql(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return buildWeightedSearchVectorSql([
      { expr: `${prefix}title`, weight: 'A' },
      { expr: `${prefix}description`, weight: 'B' },
      { expr: `${prefix}author`, weight: 'C' },
      { expr: `${prefix}content`, weight: 'D' },
    ]);
  }

export function buildArticleWhere(filters: {
    includeHidden?: boolean;
    includeDelete?: boolean;
    category?: string;
    tags?: string;
    title?: string;
    regMatch?: boolean;
    startTime?: string;
    endTime?: string;
    archiveYear?: number;
    archiveMonth?: number;
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
      if (regMatch) {
        params.push(`%${filters.category}%`);
        clauses.push(`
          (
            a.category ILIKE $${params.length}
            OR EXISTS (
              SELECT 1
              FROM unnest(a.categories) AS category_name
              WHERE category_name ILIKE $${params.length}
            )
          )
        `);
      } else {
        params.push(filters.category);
        clauses.push(`(a.category = $${params.length} OR $${params.length} = ANY(a.categories))`);
      }
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
    // 归档按月筛选：用与 getArchiveSummary 分桶相同的 EXTRACT（会话时区）口径，
    // 避免汇总按本地月分桶、详情按 UTC 边界过滤导致月份边界文章丢失/错位。
    if (filters.archiveYear && filters.archiveMonth) {
      params.push(filters.archiveYear);
      clauses.push(`EXTRACT(YEAR FROM a.created_at)::int = $${params.length}`);
      params.push(filters.archiveMonth);
      clauses.push(`EXTRACT(MONTH FROM a.created_at)::int = $${params.length}`);
    }

    return {
      params,
      whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    };
  }

export function buildArticleOrderSql(option: SearchArticleOption, isPublic: boolean) {
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
