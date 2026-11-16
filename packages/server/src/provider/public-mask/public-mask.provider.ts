import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { StructuredDataService } from 'src/storage/structured-data.service';
import {
  compilePublicMask,
  INACTIVE_PUBLIC_MASKER,
  normalizePublicMaskSetting,
  PublicMasker,
  PublicTextMasker,
} from 'src/utils/publicMask';

/** Small LRU for masked text, bounded by total characters. */
export class MaskedTextCache {
  private readonly entries = new Map<string, string>();
  private totalChars = 0;

  constructor(
    private readonly maxTotalChars: number,
    private readonly maxEntryChars: number,
  ) {}

  get(key: string) {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: string) {
    if (value.length > this.maxEntryChars) {
      return;
    }
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.totalChars -= existing.length;
      this.entries.delete(key);
    }
    this.entries.set(key, value);
    this.totalChars += value.length;
    for (const [oldestKey, oldestValue] of this.entries) {
      if (this.totalChars <= this.maxTotalChars) {
        break;
      }
      this.entries.delete(oldestKey);
      this.totalChars -= oldestValue.length;
    }
  }

  clear() {
    this.entries.clear();
    this.totalChars = 0;
  }
}

type TaxonomyKind = 'tag' | 'category';

interface CachedMasker {
  masker: PublicMasker;
  rawKey: string;
  checkedAt: number;
  failed: boolean;
}

@Injectable()
export class PublicMaskProvider {
  static readonly RELOAD_INTERVAL_MS = 5000;
  static readonly TAXONOMY_TTL_MS = 60_000;

  private readonly logger = new Logger(PublicMaskProvider.name);
  private cached: CachedMasker | null = null;
  private pending: Promise<PublicMasker> | null = null;
  private readonly taxonomyCache = new Map<
    TaxonomyKind,
    { version: string; expiresAt: number; map: Map<string, string[]> }
  >();
  private readonly textCache = new MaskedTextCache(32 * 1024 * 1024, 4 * 1024 * 1024);

  constructor(private readonly structuredDataService: StructuredDataService) {}

  /**
   * Returns the compiled masker for the current setting. The setting is re-read at
   * most every few seconds, so imports and edits made elsewhere take effect quickly.
   * Throws ServiceUnavailableException when the stored rules cannot be compiled:
   * public output fails closed rather than leaking.
   */
  async getMasker(): Promise<PublicMasker> {
    const cached = this.cached;
    if (cached && Date.now() - cached.checkedAt < PublicMaskProvider.RELOAD_INTERVAL_MS) {
      if (cached.failed) {
        throw new ServiceUnavailableException('Public output is temporarily unavailable');
      }
      return cached.masker;
    }
    if (!this.pending) {
      this.pending = this.load().finally(() => {
        this.pending = null;
      });
    }
    return this.pending;
  }

  /** Forces the next getMasker() call to reload the setting. */
  invalidate() {
    if (this.cached) {
      this.cached.checkedAt = 0;
    }
    this.taxonomyCache.clear();
    this.textCache.clear();
  }

  private async load(): Promise<PublicMasker> {
    const row = await this.structuredDataService.getSetting('publicMask');
    const rawKey = JSON.stringify(row?.value ?? null);
    const now = Date.now();
    if (this.cached && this.cached.rawKey === rawKey) {
      this.cached.checkedAt = now;
      if (this.cached.failed) {
        throw new ServiceUnavailableException('Public output is temporarily unavailable');
      }
      return this.cached.masker;
    }
    try {
      const masker = row?.value
        ? compilePublicMask(normalizePublicMaskSetting(row.value))
        : INACTIVE_PUBLIC_MASKER;
      if (this.cached?.masker.version !== masker.version) {
        this.taxonomyCache.clear();
        this.textCache.clear();
      }
      this.cached = { masker, rawKey, checkedAt: now, failed: false };
      return masker;
    } catch (error) {
      // Log the failure without echoing any rule content.
      this.logger.error(
        `Public mask rules failed to compile: ${(error as any)?.code || 'unknown'}`,
      );
      this.cached = { masker: INACTIVE_PUBLIC_MASKER, rawKey, checkedAt: now, failed: true };
      throw new ServiceUnavailableException('Public output is temporarily unavailable');
    }
  }

  /**
   * Masks text through the LRU. `key` must identify the source text, e.g. id plus
   * updatedAt. `transform` replaces plain masking for formats such as JSON files.
   */
  maskCached(
    masker: PublicMasker,
    key: string,
    text: string,
    transform: (text: string) => string = (value) => masker.mask(value),
  ) {
    if (!masker.active || typeof text !== 'string' || !text) {
      return text;
    }
    const cacheKey = `${masker.version}:${key}`;
    const hit = this.textCache.get(cacheKey);
    if (hit !== undefined) {
      return hit;
    }
    const masked = transform(text);
    this.textCache.set(cacheKey, masked);
    return masked;
  }

  /** Returns a text masker bound to `masker`, or undefined when masking is inactive. */
  createTextMasker(masker: PublicMasker): PublicTextMasker | undefined {
    if (!masker.active) {
      return undefined;
    }
    return (text: string, cacheKey?: string) =>
      cacheKey ? this.maskCached(masker, cacheKey, text) : masker.mask(text);
  }

  /** Public URL segment for an article: its pathname unless that contains a hit. */
  toPublicArticlePath(
    article: { id?: number | string; pathname?: string } | null | undefined,
    masker: PublicMasker,
  ) {
    const pathname = article?.pathname ? String(article.pathname) : '';
    if (pathname && !masker.hasHit(pathname)) {
      return pathname;
    }
    return String(article?.id ?? '');
  }

  /**
   * Maps a tag or category name received from a public URL back to its stored name.
   * Public pages only ever see masked names, so a label such as `<replacement>-infra` must resolve to the
   * raw name. Returns null when the name cannot be resolved unambiguously, or when
   * it is a raw name that contains a masked term (that name is not addressable).
   */
  async resolvePublicTaxonomyName(kind: TaxonomyKind, name: string, masker: PublicMasker) {
    if (!masker.active || !name) {
      return name;
    }
    if (masker.hasHit(name)) {
      return null;
    }
    const map = await this.getTaxonomyMap(kind, masker);
    const candidates = map.get(name);
    if (!candidates) {
      return name;
    }
    return candidates.length === 1 ? candidates[0] : null;
  }

  private async getTaxonomyMap(kind: TaxonomyKind, masker: PublicMasker) {
    const cached = this.taxonomyCache.get(kind);
    if (cached && cached.version === masker.version && cached.expiresAt > Date.now()) {
      return cached.map;
    }
    const names =
      kind === 'tag'
        ? await this.structuredDataService.listTagNames()
        : ((await this.structuredDataService.listCategories()) as any[]).map((item) =>
            String(item?.name || ''),
          );
    const map = new Map<string, string[]>();
    for (const raw of names.filter(Boolean)) {
      const masked = masker.mask(raw);
      map.set(masked, [...(map.get(masked) || []), raw]);
    }
    this.taxonomyCache.set(kind, {
      version: masker.version,
      expiresAt: Date.now() + PublicMaskProvider.TAXONOMY_TTL_MS,
      map,
    });
    return map;
  }
}
