import { PostgresStoreService } from './postgres-store.service';
import { asDate, normalizeNumericId } from './structured-data.mappers';

export type RecordDeduper = <T>(
  records: T[],
  label: string,
  getKey: (record: T) => string | null | undefined,
) => T[];

export class StructuredDataCommentsRepository {
  constructor(
    private readonly store: PostgresStoreService,
    private readonly dedupeRecords: RecordDeduper,
  ) {}

  // ---------------------------------------------------------------------------
  // Comments
  //
  // Records live in the `comments` and `comment_likes` collections; these
  // tables are the query side and are rebuilt from the records on startup.
  // ---------------------------------------------------------------------------

  private static readonly COMMENT_COLUMNS = `
    id, target_type, target_id, parent_id, root_id, reply_to_nick, nick, mail, link,
    content, status, is_admin, pinned, likes, ip, ua, location, browser, os, images,
    created_at, updated_at, source_record_id
  `;

  /** A root is publicly visible when approved or when it is a placeholder for visible replies. */
  private static readonly COMMENT_ROOT_VISIBLE_SQL = `(
    c.status = 'approved'
    OR (
      c.status = 'deleted'
      AND EXISTS (
        SELECT 1 FROM vanblog_comments visible_reply
        WHERE visible_reply.root_id = c.id AND visible_reply.status = 'approved'
      )
    )
  )`;

  private normalizeCommentImages(images: any): string[] {
    if (!Array.isArray(images)) {
      return [];
    }
    return [...new Set(images.map((item) => String(item || '').trim()).filter(Boolean))];
  }

  private normalizeOptionalCommentId(value: any) {
    const normalized = normalizeNumericId(value);
    return normalized === null || normalized <= 0 ? null : normalized;
  }

  private toCommentRowParams(comment: any, id: number) {
    return [
      id,
      String(comment.targetType),
      String(comment.targetId),
      this.normalizeOptionalCommentId(comment.parentId),
      this.normalizeOptionalCommentId(comment.rootId),
      comment.replyToNick === undefined || comment.replyToNick === null
        ? null
        : String(comment.replyToNick),
      String(comment.nick ?? ''),
      String(comment.mail ?? ''),
      String(comment.link ?? ''),
      String(comment.content ?? ''),
      String(comment.status || 'pending'),
      Boolean(comment.isAdmin),
      Boolean(comment.pinned),
      Math.max(0, Math.trunc(Number(comment.likes) || 0)),
      String(comment.ip ?? ''),
      String(comment.ua ?? ''),
      String(comment.location ?? ''),
      String(comment.browser ?? ''),
      String(comment.os ?? ''),
      this.normalizeCommentImages(comment.images),
      asDate(comment.createdAt),
      asDate(comment.updatedAt || comment.createdAt),
      comment._id || null,
    ];
  }

  private isStorableComment(comment: any) {
    const id = normalizeNumericId(comment?.id);
    return (
      id !== null &&
      id > 0 &&
      Number.isSafeInteger(id) &&
      Boolean(comment?.targetType) &&
      comment?.targetId !== undefined &&
      comment?.targetId !== null &&
      String(comment.targetId) !== ''
    );
  }

  private mapCommentRow(row: any) {
    if (!row) {
      return null;
    }
    const optionalId = (value: any) =>
      value === null || value === undefined ? null : Number(value);
    return {
      _id: row.source_record_id || undefined,
      id: Number(row.id),
      targetType: row.target_type,
      targetId: row.target_id,
      parentId: optionalId(row.parent_id),
      rootId: optionalId(row.root_id),
      replyToNick: row.reply_to_nick ?? null,
      nick: row.nick || '',
      mail: row.mail || '',
      link: row.link || '',
      content: row.content || '',
      status: row.status,
      isAdmin: Boolean(row.is_admin),
      pinned: Boolean(row.pinned),
      likes: Number(row.likes || 0),
      ip: row.ip || '',
      ua: row.ua || '',
      location: row.location || '',
      browser: row.browser || '',
      os: row.os || '',
      images: Array.isArray(row.images) ? row.images : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.parent_excerpt === undefined
        ? {}
        : { parentExcerpt: row.parent_excerpt === null ? undefined : row.parent_excerpt }),
    };
  }

  async replaceComments(comments: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_comments CASCADE');
    for (const comment of this.dedupeRecords(comments, 'comment ids', (comment) =>
      String(normalizeNumericId(comment?.id) ?? ''),
    )) {
      if (!this.isStorableComment(comment)) {
        continue;
      }
      await this.store.query(
        `INSERT INTO vanblog_comments (${StructuredDataCommentsRepository.COMMENT_COLUMNS})
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::text[],$21,$22,$23)`,
        this.toCommentRowParams(comment, normalizeNumericId(comment.id)!),
      );
    }
  }

  async replaceCommentLikes(likes: any[]) {
    await this.store.query('TRUNCATE TABLE vanblog_comment_likes CASCADE');
    for (const like of this.dedupeRecords(likes, 'comment likes', (like) => {
      const commentId = this.normalizeOptionalCommentId(like?.commentId);
      return commentId === null || !like?.actorHash ? '' : `${commentId}:${like.actorHash}`;
    })) {
      const commentId = this.normalizeOptionalCommentId(like?.commentId);
      if (commentId === null || !like?.actorHash) {
        continue;
      }
      await this.store.query(
        `INSERT INTO vanblog_comment_likes (comment_id, actor_hash, created_at, source_record_id)
         VALUES ($1,$2,$3,$4)`,
        [commentId, String(like.actorHash), asDate(like.createdAt), like._id || null],
      );
    }
  }

  async upsertComment(comment: any) {
    if (!this.isStorableComment(comment)) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_comments (${StructuredDataCommentsRepository.COMMENT_COLUMNS})
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::text[],$21,$22,$23)
        ON CONFLICT (id) DO UPDATE SET
          target_type = EXCLUDED.target_type,
          target_id = EXCLUDED.target_id,
          parent_id = EXCLUDED.parent_id,
          root_id = EXCLUDED.root_id,
          reply_to_nick = EXCLUDED.reply_to_nick,
          nick = EXCLUDED.nick,
          mail = EXCLUDED.mail,
          link = EXCLUDED.link,
          content = EXCLUDED.content,
          status = EXCLUDED.status,
          is_admin = EXCLUDED.is_admin,
          pinned = EXCLUDED.pinned,
          likes = EXCLUDED.likes,
          ip = EXCLUDED.ip,
          ua = EXCLUDED.ua,
          location = EXCLUDED.location,
          browser = EXCLUDED.browser,
          os = EXCLUDED.os,
          images = EXCLUDED.images,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          source_record_id = EXCLUDED.source_record_id
      `,
      this.toCommentRowParams(comment, normalizeNumericId(comment.id)!),
    );
  }

  async deleteCommentsByIds(ids: number[]) {
    const normalized = this.normalizeCommentIdList(ids);
    if (!normalized.length) {
      return;
    }
    await this.store.query('DELETE FROM vanblog_comments WHERE id = ANY($1::bigint[])', [
      normalized,
    ]);
  }

  async upsertCommentLike(like: any) {
    const commentId = this.normalizeOptionalCommentId(like?.commentId);
    if (commentId === null || !like?.actorHash) {
      return;
    }
    await this.store.query(
      `
        INSERT INTO vanblog_comment_likes (comment_id, actor_hash, created_at, source_record_id)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (comment_id, actor_hash) DO UPDATE SET
          source_record_id = EXCLUDED.source_record_id
      `,
      [commentId, String(like.actorHash), asDate(like.createdAt), like._id || null],
    );
  }

  async deleteCommentLike(commentId: number, actorHash: string) {
    await this.store.query(
      'DELETE FROM vanblog_comment_likes WHERE comment_id = $1 AND actor_hash = $2',
      [commentId, actorHash],
    );
  }

  async deleteCommentLikesByCommentIds(ids: number[]) {
    const normalized = this.normalizeCommentIdList(ids);
    if (!normalized.length) {
      return;
    }
    await this.store.query(
      'DELETE FROM vanblog_comment_likes WHERE comment_id = ANY($1::bigint[])',
      [normalized],
    );
  }

  private normalizeCommentIdList(ids: any[]) {
    return [
      ...new Set(
        (ids || [])
          .map((id) => this.normalizeOptionalCommentId(id))
          .filter((id): id is number => id !== null && Number.isSafeInteger(id)),
      ),
    ];
  }

  async getCommentById(id: number) {
    const [comment] = await this.getCommentsByIds([id]);
    return comment || null;
  }

  async getCommentsByIds(ids: number[]) {
    const normalized = this.normalizeCommentIdList(ids);
    if (!normalized.length) {
      return [];
    }
    const result = await this.store.query(
      `SELECT * FROM vanblog_comments WHERE id = ANY($1::bigint[]) ORDER BY id ASC`,
      [normalized],
    );
    return result.rows.map((row) => this.mapCommentRow(row)).filter(Boolean);
  }

  /**
   * One page of publicly visible root comments of a target plus their visible
   * replies (chronological, capped). Soft-deleted roots that still have visible
   * replies are returned with `status: 'deleted'` so the caller can render a
   * placeholder.
   */
  async queryPublicComments(option: {
    targetType: string;
    targetId: string;
    sort: 'latest' | 'oldest' | 'hot';
    page: number;
    pageSize: number;
    maxReplies: number;
  }) {
    const orderSql = {
      latest: 'c.created_at DESC, c.id DESC',
      oldest: 'c.created_at ASC, c.id ASC',
      hot: `(CASE WHEN c.status = 'approved' THEN c.likes ELSE 0 END) DESC, c.created_at DESC, c.id DESC`,
    }[option.sort || 'latest'];
    const pageSize = Math.max(1, Math.trunc(option.pageSize));
    const page = Math.max(1, Math.trunc(option.page));
    const stats = await this.countPublicCommentThread(option.targetType, option.targetId);
    const rootsResult = await this.store.query(
      `
        SELECT c.*
        FROM vanblog_comments c
        WHERE c.target_type = $1
          AND c.target_id = $2
          AND c.root_id IS NULL
          AND ${StructuredDataCommentsRepository.COMMENT_ROOT_VISIBLE_SQL}
        ORDER BY (c.status = 'approved' AND c.pinned) DESC, ${orderSql}
        LIMIT $3 OFFSET $4
      `,
      [option.targetType, option.targetId, pageSize, (page - 1) * pageSize],
    );
    const roots = rootsResult.rows.map((row) => this.mapCommentRow(row)).filter(Boolean);
    let replies: any[] = [];
    let repliesTruncated = false;
    if (roots.length) {
      const maxReplies = Math.max(0, Math.trunc(option.maxReplies));
      const repliesResult = await this.store.query(
        `
          SELECT c.*
          FROM vanblog_comments c
          WHERE c.root_id = ANY($1::bigint[])
            AND c.target_type = $2
            AND c.target_id = $3
            AND c.status = 'approved'
          ORDER BY c.created_at ASC, c.id ASC
          LIMIT $4
        `,
        [roots.map((root) => root.id), option.targetType, option.targetId, maxReplies + 1],
      );
      replies = repliesResult.rows.map((row) => this.mapCommentRow(row)).filter(Boolean);
      if (replies.length > maxReplies) {
        repliesTruncated = true;
        replies = replies.slice(0, maxReplies);
      }
    }
    return { ...stats, roots, replies, repliesTruncated };
  }

  /** `total`: visible roots incl. placeholders; `count`: visible approved comments. */
  async countPublicCommentThread(targetType: string, targetId: string) {
    const result = await this.store.query<{ total: number; count: number }>(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM vanblog_comments c
            WHERE c.target_type = $1
              AND c.target_id = $2
              AND c.root_id IS NULL
              AND ${StructuredDataCommentsRepository.COMMENT_ROOT_VISIBLE_SQL}
          )::int AS total,
          (
            SELECT COUNT(*)
            FROM vanblog_comments c
            LEFT JOIN vanblog_comments root ON root.id = c.root_id
            WHERE c.target_type = $1
              AND c.target_id = $2
              AND c.status = 'approved'
              AND (c.root_id IS NULL OR root.status IN ('approved', 'deleted'))
          )::int AS count
      `,
      [targetType, targetId],
    );
    return {
      total: Number(result.rows[0]?.total || 0),
      count: Number(result.rows[0]?.count || 0),
    };
  }

  /** Visible approved comments per target, keyed by `${type}:${id}`; missing targets are 0. */
  async countVisibleCommentsByTargets(targets: Array<{ type: string; id: string }>) {
    const counts: Record<string, number> = {};
    const unique = new Map<string, { type: string; id: string }>();
    for (const target of targets || []) {
      const key = `${target.type}:${target.id}`;
      counts[key] = 0;
      unique.set(key, target);
    }
    if (!unique.size) {
      return counts;
    }
    const list = [...unique.values()];
    const result = await this.store.query<{
      target_type: string;
      target_id: string;
      count: number;
    }>(
      `
        SELECT c.target_type, c.target_id, COUNT(*)::int AS count
        FROM vanblog_comments c
        LEFT JOIN vanblog_comments root ON root.id = c.root_id
        WHERE (c.target_type, c.target_id) IN (
            SELECT t.target_type, t.target_id
            FROM unnest($1::text[], $2::text[]) AS t(target_type, target_id)
          )
          AND c.status = 'approved'
          AND (c.root_id IS NULL OR root.status IN ('approved', 'deleted'))
        GROUP BY c.target_type, c.target_id
      `,
      [list.map((item) => item.type), list.map((item) => item.id)],
    );
    for (const row of result.rows) {
      counts[`${row.target_type}:${row.target_id}`] = Number(row.count || 0);
    }
    return counts;
  }

  async countCommentLikes(commentId: number) {
    const result = await this.store.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM vanblog_comment_likes WHERE comment_id = $1',
      [commentId],
    );
    return Number(result.rows[0]?.total || 0);
  }

  async getLikedCommentIds(actorHash: string, ids: number[]) {
    const normalized = this.normalizeCommentIdList(ids);
    if (!actorHash || !normalized.length) {
      return [];
    }
    const result = await this.store.query<{ comment_id: string }>(
      `
        SELECT comment_id
        FROM vanblog_comment_likes
        WHERE actor_hash = $1 AND comment_id = ANY($2::bigint[])
        ORDER BY comment_id ASC
      `,
      [actorHash, normalized],
    );
    return result.rows.map((row) => Number(row.comment_id));
  }

  /** Escapes LIKE wildcards so admin search terms match literally. */
  private toLiteralLikePattern(value: string) {
    return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  }

  async queryAdminComments(option: {
    status?: string;
    search?: string;
    targetType?: string;
    targetId?: string;
    page: number;
    pageSize: number;
  }) {
    const params: any[] = [];
    const clauses: string[] = [];
    if (option.status) {
      params.push(option.status);
      clauses.push(`c.status = $${params.length}`);
    }
    if (option.targetType && option.targetId !== undefined) {
      params.push(option.targetType, option.targetId);
      clauses.push(`c.target_type = $${params.length - 1} AND c.target_id = $${params.length}`);
    }
    const search = String(option.search || '').trim();
    if (search) {
      params.push(this.toLiteralLikePattern(search));
      const ref = `$${params.length}`;
      clauses.push(`(
        c.content ILIKE ${ref} ESCAPE '\\'
        OR c.nick ILIKE ${ref} ESCAPE '\\'
        OR c.mail ILIKE ${ref} ESCAPE '\\'
        OR c.ip ILIKE ${ref} ESCAPE '\\'
      )`);
    }
    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const countResult = await this.store.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM vanblog_comments c ${whereSql}`,
      params,
    );
    const pageSize = Math.max(1, Math.trunc(option.pageSize));
    const page = Math.max(1, Math.trunc(option.page));
    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const result = await this.store.query(
      `
        SELECT c.*, LEFT(parent.content, 120) AS parent_excerpt
        FROM vanblog_comments c
        LEFT JOIN vanblog_comments parent ON parent.id = c.parent_id
        ${whereSql}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `,
      dataParams,
    );
    return {
      total: Number(countResult.rows[0]?.total || 0),
      comments: result.rows.map((row) => this.mapCommentRow(row)).filter(Boolean),
    };
  }

  async getCommentStats(recentSize: number) {
    const counts = await this.store.query<{ status: string; total: number }>(
      'SELECT status, COUNT(*)::int AS total FROM vanblog_comments GROUP BY status',
    );
    const recent = await this.store.query(
      `
        SELECT c.*, LEFT(parent.content, 120) AS parent_excerpt
        FROM vanblog_comments c
        LEFT JOIN vanblog_comments parent ON parent.id = c.parent_id
        WHERE c.status <> 'deleted'
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT $1
      `,
      [Math.max(0, Math.trunc(recentSize))],
    );
    const byStatus: Record<string, number> = {};
    for (const row of counts.rows) {
      byStatus[row.status] = Number(row.total || 0);
    }
    return {
      byStatus,
      recent: recent.rows.map((row) => this.mapCommentRow(row)).filter(Boolean),
    };
  }

  async countAllComments() {
    const result = await this.store.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM vanblog_comments',
    );
    return Number(result.rows[0]?.total || 0);
  }

  /** Ids of every reply below a comment (direct and nested), ascending. */
  async getCommentDescendantIds(id: number) {
    const result = await this.store.query<{ id: string }>(
      `
        WITH RECURSIVE tree(id) AS (
          SELECT child.id FROM vanblog_comments child WHERE child.parent_id = $1
          UNION
          SELECT c.id FROM vanblog_comments c JOIN tree t ON c.parent_id = t.id
        )
        SELECT id FROM tree
        UNION
        SELECT id FROM vanblog_comments WHERE root_id = $1
        ORDER BY id ASC
      `,
      [id],
    );
    return result.rows.map((row) => Number(row.id)).filter((item) => item !== Number(id));
  }

  /**
   * Article facts the comment system needs to decide whether a thread is open
   * and how to link to it. Deleted articles are included with `deleted: true`.
   */
  async getCommentTargetArticles(ids: number[]) {
    const normalized = this.normalizeCommentIdList(ids);
    if (!normalized.length) {
      return [];
    }
    const result = await this.store.query(
      `
        SELECT
          a.id,
          a.title,
          a.pathname,
          a.hidden,
          a.private_flag,
          a.deleted,
          EXISTS (
            SELECT 1
            FROM vanblog_categories category
            WHERE category.private_flag = TRUE
              AND category.name = ANY(
                CASE
                  WHEN cardinality(a.categories) > 0 THEN a.categories
                  WHEN a.category IS NOT NULL AND a.category <> '' THEN ARRAY[a.category]::text[]
                  ELSE ARRAY[]::text[]
                END
              )
          ) AS private_category
        FROM vanblog_articles a
        WHERE a.id = ANY($1::bigint[])
      `,
      [normalized],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      title: row.title || '',
      pathname: row.pathname || '',
      hidden: Boolean(row.hidden),
      private: Boolean(row.private_flag),
      privateCategory: Boolean(row.private_category),
      deleted: Boolean(row.deleted),
    }));
  }

  /** The subset of `names` (image file names) still referenced by any stored comment. */
  async getReferencedCommentImages(names: string[]) {
    const normalized = [
      ...new Set((names || []).map((name) => String(name || '')).filter(Boolean)),
    ];
    if (!normalized.length) {
      return [];
    }
    const result = await this.store.query<{ name: string }>(
      `
        SELECT DISTINCT image AS name
        FROM vanblog_comments c, unnest(c.images) AS image
        WHERE c.images && $1::text[] AND image = ANY($1::text[])
        ORDER BY image ASC
      `,
      [normalized],
    );
    return result.rows.map((row) => row.name);
  }
}
