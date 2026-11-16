import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { config } from 'src/config';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { CustomPageProvider } from 'src/provider/customPage/customPage.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { MomentProvider } from 'src/provider/moment/moment.provider';
import { NavCategoryProvider } from 'src/provider/nav-category/nav-category.provider';
import { NavToolProvider } from 'src/provider/nav-tool/nav-tool.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { isMaskableTextFile, PublicMasker, PublicMaskHit } from 'src/utils/publicMask';

export type PublicMaskScanSource =
  | 'article'
  | 'moment'
  | 'about'
  | 'siteInfo'
  | 'social'
  | 'link'
  | 'reward'
  | 'menu'
  | 'layout'
  | 'customPage'
  | 'tag'
  | 'category'
  | 'navTool'
  | 'navCategory'
  | 'staticFile';

/** Consequences the owner should know about before enabling the rules. */
export type PublicMaskScanWarning =
  | 'PATHNAME_REPLACED_BY_ID'
  | 'TAXONOMY_RENAMED'
  | 'TAXONOMY_COLLISION'
  | 'CUSTOM_PAGE_HIDDEN'
  | 'STATIC_FILE_HIDDEN'
  | 'URL_MASKED'
  | 'SECRET_FOUND';

export interface PublicMaskScanItem {
  source: PublicMaskScanSource;
  id?: string | number;
  title?: string;
  field: string;
  hidden?: boolean;
  count: number;
  hits: Array<Pick<PublicMaskHit, 'kind' | 'source' | 'match'>>;
  warnings: PublicMaskScanWarning[];
}

export interface PublicMaskScanResult {
  generatedAt: string;
  totals: { items: number; hits: number; truncated: boolean };
  warnings: Partial<Record<PublicMaskScanWarning, number>>;
  items: PublicMaskScanItem[];
}

const MAX_ITEMS = 1000;
const MAX_HITS_PER_ITEM = 20;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const URL_PATTERN = /(?:https?:)?\/\/[^\s)"'<>\]]+|\]\(([^)\s]+)\)/g;
const SECRET_HIT_KINDS = new Set(['secret']);

/**
 * Admin-only report of where masking rules hit. It reads raw content, so its
 * output must never be served on a public route.
 */
@Injectable()
export class PublicMaskScanService {
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly momentProvider: MomentProvider,
    private readonly metaProvider: MetaProvider,
    private readonly settingProvider: SettingProvider,
    private readonly customPageProvider: CustomPageProvider,
    private readonly staticProvider: StaticProvider,
    private readonly navToolProvider: NavToolProvider,
    private readonly navCategoryProvider: NavCategoryProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  async scan(masker: PublicMasker): Promise<PublicMaskScanResult> {
    const items: PublicMaskScanItem[] = [];
    let truncated = false;

    const add = (
      base: Omit<PublicMaskScanItem, 'count' | 'hits' | 'warnings'>,
      text: unknown,
      extraWarnings: PublicMaskScanWarning[] = [],
    ) => {
      if (typeof text !== 'string' || !text) {
        return;
      }
      const hits = masker.findHits(text, 500);
      if (!hits.length) {
        return;
      }
      if (items.length >= MAX_ITEMS) {
        truncated = true;
        return;
      }
      const warnings = new Set<PublicMaskScanWarning>(extraWarnings);
      if (hits.some((hit) => SECRET_HIT_KINDS.has(hit.kind))) {
        warnings.add('SECRET_FOUND');
      }
      for (const found of text.matchAll(URL_PATTERN)) {
        if (masker.hasHit(found[1] || found[0])) {
          warnings.add('URL_MASKED');
          break;
        }
      }
      const unique = new Map<string, Pick<PublicMaskHit, 'kind' | 'source' | 'match'>>();
      for (const hit of hits) {
        const key = `${hit.kind}:${hit.match.toLowerCase()}`;
        if (!unique.has(key) && unique.size < MAX_HITS_PER_ITEM) {
          unique.set(key, { kind: hit.kind, source: hit.source, match: hit.match });
        }
      }
      items.push({
        ...base,
        count: hits.length,
        hits: [...unique.values()],
        warnings: [...warnings],
      });
    };

    const addObject = (
      base: Omit<PublicMaskScanItem, 'count' | 'hits' | 'warnings' | 'field'>,
      value: unknown,
      prefix: string,
    ) => {
      const visit = (node: unknown, field: string) => {
        if (typeof node === 'string') {
          add({ ...base, field }, node);
        } else if (Array.isArray(node)) {
          node.forEach((item, index) => visit(item, `${field}[${index}]`));
        } else if (node && typeof node === 'object') {
          for (const [key, child] of Object.entries(node)) {
            visit(child, field ? `${field}.${key}` : key);
          }
        }
      };
      visit(value, prefix);
    };

    if (masker.active) {
      await this.scanArticles(masker, add);
      await this.scanMoments(add);
      await this.scanMeta(addObject, add);
      await this.scanTaxonomy(masker, add);
      await this.scanCustomPages(masker, add);
      await this.scanNav(addObject);
      this.scanStaticFileNames(masker, add);
    }

    const warnings: Partial<Record<PublicMaskScanWarning, number>> = {};
    for (const item of items) {
      for (const warning of item.warnings) {
        warnings[warning] = (warnings[warning] || 0) + 1;
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      totals: {
        items: items.length,
        hits: items.reduce((sum, item) => sum + item.count, 0),
        truncated,
      },
      warnings,
      items,
    };
  }

  private async scanArticles(masker: PublicMasker, add: any) {
    const articles = (await this.articleProvider.getAll('admin', true, false)) as any[];
    for (const article of articles) {
      const base = {
        source: 'article',
        id: article.id,
        title: article.title,
        hidden: Boolean(article.hidden),
      };
      add({ ...base, field: 'title' }, article.title);
      add({ ...base, field: 'content' }, article.content);
      add({ ...base, field: 'author' }, article.author);
      add({ ...base, field: 'copyright' }, article.copyright);
      if (article.pathname) {
        add({ ...base, field: 'pathname' }, String(article.pathname), ['PATHNAME_REPLACED_BY_ID']);
      }
      for (const tag of article.tags || []) {
        add({ ...base, field: 'tags' }, tag);
      }
      for (const category of this.articleProvider.getArticleCategories(article)) {
        add({ ...base, field: 'categories' }, category);
      }
    }
  }

  private async scanMoments(add: any) {
    const { moments } = await this.momentProvider.getByOption(
      { page: 1, pageSize: -1 } as any,
      false,
    );
    for (const moment of (moments || []) as any[]) {
      add({ source: 'moment', id: moment.id, field: 'content' }, moment.content);
    }
  }

  private async scanMeta(addObject: any, add: any) {
    const meta: any = await this.metaProvider.getAll();
    const doc = meta?._doc || meta || {};
    add({ source: 'about', field: 'content' }, doc?.about?.content);
    addObject({ source: 'siteInfo' }, doc?.siteInfo, '');
    addObject({ source: 'social' }, doc?.socials, '');
    addObject({ source: 'link' }, doc?.links, '');
    addObject({ source: 'reward' }, doc?.rewards, '');
    const menu = await this.settingProvider.getMenuSetting();
    addObject({ source: 'menu' }, menu?.data, '');
    const layout = await this.settingProvider.getLayoutSetting();
    addObject({ source: 'layout' }, layout, '');
  }

  private async scanTaxonomy(masker: PublicMasker, add: any) {
    const tags = await this.structuredDataService.listTagNames();
    const categories = ((await this.structuredDataService.listCategories()) as any[]).map((item) =>
      String(item?.name || ''),
    );
    for (const [source, names] of [
      ['tag', tags],
      ['category', categories],
    ] as const) {
      const owners = new Map<string, string[]>();
      for (const name of names.filter(Boolean)) {
        const masked = masker.mask(name);
        owners.set(masked, [...(owners.get(masked) || []), name]);
      }
      for (const name of names.filter(Boolean)) {
        const collides = (owners.get(masker.mask(name)) || []).length > 1;
        add({ source, id: name, title: name, field: 'name' }, name, [
          collides ? 'TAXONOMY_COLLISION' : 'TAXONOMY_RENAMED',
        ]);
      }
    }
  }

  private async scanCustomPages(masker: PublicMasker, add: any) {
    const pages = (await this.customPageProvider.getAll(true)) as any[];
    for (const page of pages) {
      const base = { source: 'customPage', id: page.path, title: page.name };
      add({ ...base, field: 'path' }, page.path, ['CUSTOM_PAGE_HIDDEN']);
      add({ ...base, field: 'name' }, page.name);
      if (page.type === 'folder') {
        const root = this.staticProvider.resolveCustomPageAssetPath(page.path);
        for (const filePath of this.listTextFiles(root)) {
          const content = fs.readFileSync(filePath, 'utf8');
          add({ ...base, field: path.relative(root, filePath) }, content);
        }
      } else {
        add({ ...base, field: 'html' }, page.html);
      }
    }
  }

  private async scanNav(addObject: any) {
    const [tools, categories] = await Promise.all([
      this.navToolProvider.getAllTools(),
      this.navCategoryProvider.getAllCategories(),
    ]);
    for (const tool of tools || []) {
      addObject(
        { source: 'navTool', id: tool._id, title: tool.name },
        { name: tool.name, url: tool.url, description: tool.description, logo: tool.logo },
        '',
      );
    }
    for (const category of categories || []) {
      addObject(
        { source: 'navCategory', id: (category as any)._id, title: (category as any).name },
        { name: (category as any).name, description: (category as any).description },
        '',
      );
    }
  }

  private scanStaticFileNames(masker: PublicMasker, add: any) {
    for (const dir of ['img', 'music', 'font', 'customPage']) {
      const root = path.join(config.staticPath, dir);
      for (const filePath of this.walkFiles(root, 20000)) {
        const relative = path.relative(config.staticPath, filePath);
        if (masker.hasHit(relative)) {
          add({ source: 'staticFile', id: relative, field: 'name' }, relative, [
            'STATIC_FILE_HIDDEN',
          ]);
        }
      }
    }
  }

  private listTextFiles(root: string) {
    return this.walkFiles(root, 2000).filter((filePath) => {
      if (!isMaskableTextFile(filePath)) {
        return false;
      }
      try {
        return fs.statSync(filePath).size <= MAX_FILE_BYTES;
      } catch {
        return false;
      }
    });
  }

  private walkFiles(root: string, limit: number) {
    const files: string[] = [];
    const stack = [root];
    while (stack.length && files.length < limit) {
      const current = stack.pop()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          files.push(full);
        }
      }
    }
    return files;
  }
}
