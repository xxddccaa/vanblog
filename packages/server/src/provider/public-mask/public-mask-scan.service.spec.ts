import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from 'src/config';
import { compilePublicMask, defaultPublicMaskSetting } from 'src/utils/publicMask';
import { PublicMaskScanService } from './public-mask-scan.service';

const masker = compilePublicMask({
  ...defaultPublicMaskSetting,
  enabled: true,
  replacements: { custom: 'X-CUSTOM-X', secret: 'X-SECRET-X', email: 'X-EMAIL-X', ip: 'X-IP-X' },
  rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
});

describe('PublicMaskScanService', () => {
  const originalStaticPath = config.staticPath;
  let staticRoot: string;

  beforeEach(() => {
    staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vanblog-scan-'));
    fs.mkdirSync(path.join(staticRoot, 'img'));
    fs.mkdirSync(path.join(staticRoot, 'customPage', 'landing'), { recursive: true });
    fs.writeFileSync(path.join(staticRoot, 'img', 'acmecore-arch.png'), 'x');
    fs.writeFileSync(
      path.join(staticRoot, 'customPage', 'landing', 'index.html'),
      '<p>acmecore</p>',
    );
    config.staticPath = staticRoot;
  });

  afterEach(() => {
    config.staticPath = originalStaticPath;
    fs.rmSync(staticRoot, { recursive: true, force: true });
  });

  const createService = () =>
    new PublicMaskScanService(
      {
        getAll: jest.fn().mockResolvedValue([
          {
            id: 1,
            title: 'Cluster',
            pathname: 'acmecore-cluster',
            content: `token ${['s', 'k-', 'Ab1'.repeat(10)].join(
              '',
            )} ![x](https://acmecore.example/a.png)`,
            tags: ['ok'],
            categories: [],
          },
          { id: 2, title: 'Clean', content: 'nothing here', tags: [], categories: [] },
        ]),
        getArticleCategories: (article: any) => article.categories || [],
      } as any,
      {
        getByOption: jest.fn().mockResolvedValue({ moments: [{ id: 5, content: 'at acmecore' }] }),
      } as any,
      {
        getAll: jest.fn().mockResolvedValue({
          about: { content: 'hello' },
          siteInfo: { siteName: 'Blog', authorDesc: 'works at acmecore' },
          socials: [],
          links: [],
          rewards: [],
        }),
      } as any,
      {
        getMenuSetting: jest.fn().mockResolvedValue({ data: [] }),
        getLayoutSetting: jest.fn().mockResolvedValue({ script: '', html: '', css: '', head: '' }),
      } as any,
      {
        getAll: jest
          .fn()
          .mockResolvedValue([{ path: '/landing', name: 'Landing', type: 'folder' }]),
      } as any,
      {
        resolveCustomPageAssetPath: (pathname: string) =>
          path.join(staticRoot, 'customPage', pathname.replace(/^\//, '')),
      } as any,
      { getAllTools: jest.fn().mockResolvedValue([]) } as any,
      { getAllCategories: jest.fn().mockResolvedValue([]) } as any,
      {
        listTagNames: jest.fn().mockResolvedValue(['acmecore-ops', 'ACMECORE-ops', 'golang']),
        listCategories: jest.fn().mockResolvedValue([{ name: 'Linux' }]),
      } as any,
    );

  it('reports hits by source with warnings about public side effects', async () => {
    const result = await createService().scan(masker);
    const bySource = (source: string, field?: string) =>
      result.items.filter((item) => item.source === source && (!field || item.field === field));

    expect(bySource('article', 'pathname')[0].warnings).toContain('PATHNAME_REPLACED_BY_ID');
    const content = bySource('article', 'content')[0];
    expect(content.warnings).toEqual(expect.arrayContaining(['SECRET_FOUND', 'URL_MASKED']));
    expect(bySource('moment')).toHaveLength(1);
    expect(bySource('siteInfo')[0].field).toBe('authorDesc');
    expect(bySource('tag').every((item) => item.warnings.includes('TAXONOMY_COLLISION'))).toBe(
      true,
    );
    expect(bySource('customPage', 'index.html')).toHaveLength(1);
    expect(bySource('staticFile')[0].warnings).toContain('STATIC_FILE_HIDDEN');
    expect(result.items.some((item) => item.id === 2)).toBe(false);
    expect(result.warnings.SECRET_FOUND).toBe(1);
  });

  it('returns nothing for an inactive masker', async () => {
    const inactive = compilePublicMask({ ...defaultPublicMaskSetting, enabled: false });
    const result = await createService().scan(inactive);
    expect(result.items).toEqual([]);
  });
});
