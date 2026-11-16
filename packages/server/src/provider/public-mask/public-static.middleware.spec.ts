import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createPublicStaticGuard, isPublicStaticPathAllowed } from './public-static.middleware';
import { recordPublicMaskArtifact } from './public-mask-artifacts';
import { PublicMaskProvider } from './public-mask.provider';
import { defaultPublicMaskSetting } from 'src/utils/publicMask';

describe('isPublicStaticPathAllowed', () => {
  it.each([
    '/img/a.png',
    '/img/2026/a.png',
    '/music/song.mp3',
    '/font/x.woff2',
    '/customPage/demo/index.html',
    '/rss/feed.xml',
    '/sitemap/sitemap.xml',
    '/markdown-themes/a.css',
    '/search-index.json',
    '/IMG/a.png',
  ])('allows %s', (value) => {
    expect(isPublicStaticPathAllowed(value)).toBe(true);
  });

  it.each([
    '/',
    '',
    '/blog-json/vanblog-backup-2026-04-14-030000.json',
    '/BLOG-JSON/x.json',
    '/export/export-img-2026-01-01.zip',
    '/tmp/x',
    '/code/script.py',
    '/random.txt',
    '/.public-mask-artifacts.json',
    '/img/.hidden',
    '/img/../blog-json/x.json',
    '/img/%2e%2e/blog-json/x.json',
    '/img/%252e%252e/blog-json/x.json',
    '/img\\..\\blog-json\\x.json',
    '/img/%00.png',
    '/img/%E0%A4%A',
  ])('denies %s', (value) => {
    expect(isPublicStaticPathAllowed(value)).toBe(false);
  });
});

describe('createPublicStaticGuard', () => {
  let root: string;
  let app: express.Express;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vanblog-static-guard-'));
    fs.mkdirSync(path.join(root, 'img'));
    fs.mkdirSync(path.join(root, 'blog-json'));
    fs.writeFileSync(path.join(root, 'img', 'a.txt'), 'public image placeholder');
    fs.writeFileSync(path.join(root, 'blog-json', 'backup.json'), '{"secret":true}');
    fs.writeFileSync(path.join(root, 'search-index.json'), '[]');

    app = express();
    app.use('/static', createPublicStaticGuard());
    app.use('/static', express.static(root));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('serves allowlisted files', async () => {
    await request(app).get('/static/img/a.txt').expect(200, 'public image placeholder');
    await request(app).get('/static/search-index.json').expect(200);
  });

  it('hides everything else, regardless of case or traversal', async () => {
    for (const url of [
      '/static/blog-json/backup.json',
      '/STATIC/blog-json/backup.json',
      '/Static/blog-json/backup.json',
      '/static/img/../blog-json/backup.json',
      '/static/img/%2e%2e/blog-json/backup.json',
    ]) {
      const response = await request(app).get(url);
      expect(response.status).toBe(404);
      expect(response.text).not.toContain('secret');
    }
  });
});

describe('createPublicStaticGuard with masking', () => {
  let root: string;
  let app: express.Express;
  let provider: PublicMaskProvider;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vanblog-static-mask-'));
    fs.mkdirSync(path.join(root, 'img'));
    fs.mkdirSync(path.join(root, 'customPage', 'demo'), { recursive: true });
    fs.mkdirSync(path.join(root, 'rss'));
    fs.writeFileSync(path.join(root, 'img', 'diagram.svg'), '<svg><text>acmecore</text></svg>');
    fs.writeFileSync(path.join(root, 'img', 'photo.png'), 'binary acmecore bytes');
    fs.writeFileSync(path.join(root, 'img', 'acmecore-logo.png'), 'x');
    fs.writeFileSync(
      path.join(root, 'customPage', 'demo', 'data.json'),
      JSON.stringify({ host: 'acmecore', quote: 'a "b"' }),
    );
    fs.writeFileSync(path.join(root, 'rss', 'feed.xml'), '<rss>masked already</rss>');

    provider = new PublicMaskProvider({
      getSetting: jest.fn().mockResolvedValue({
        value: {
          ...defaultPublicMaskSetting,
          enabled: true,
          replacements: {
            custom: 'X-CUSTOM-X',
            secret: 'X-SECRET-X',
            email: 'X-EMAIL-X',
            ip: 'X-IP-X',
          },
          rules: [{ id: 'kw', enabled: true, type: 'keyword', pattern: 'acmecore' }],
        },
      }),
    } as any);

    app = express();
    app.use('/static', createPublicStaticGuard({ staticRoot: root, masking: provider }));
    app.use('/static', express.static(root));
    app.use(
      '/rss',
      createPublicStaticGuard({ staticRoot: root, mountDir: 'rss', masking: provider }),
    );
    app.use('/rss', express.static(path.join(root, 'rss')));
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('masks text files on the fly and leaves binary files alone', async () => {
    const svg = await request(app).get('/static/img/diagram.svg').expect(200);
    expect(svg.text || svg.body.toString()).toBe('<svg><text>X-CUSTOM-X</text></svg>');
    expect(svg.headers['cache-control']).toBe('public, max-age=0, must-revalidate');

    const json = await request(app).get('/static/customPage/demo/data.json').expect(200);
    expect(JSON.parse(json.text)).toEqual({ host: 'X-CUSTOM-X', quote: 'a "b"' });

    const png = await request(app).get('/static/img/photo.png').expect(200);
    expect(png.body.toString()).toBe('binary acmecore bytes');
  });

  it('answers 304 for a matching entity tag', async () => {
    const first = await request(app).get('/static/img/diagram.svg').expect(200);
    await request(app)
      .get('/static/img/diagram.svg')
      .set('If-None-Match', first.headers.etag)
      .expect(304);
  });

  it('hides files whose path contains a masked term', async () => {
    await request(app).get('/static/img/acmecore-logo.png').expect(404);
  });

  it('holds back generated feeds until they are rebuilt with the current rules', async () => {
    await request(app).get('/rss/feed.xml').expect(503);

    const masker = await provider.getMasker();
    recordPublicMaskArtifact(root, 'rss', masker.version);
    // The guard caches artifact versions briefly; wait past that window.
    await new Promise((resolve) => setTimeout(resolve, 2100));

    const feed = await request(app).get('/rss/feed.xml').expect(200);
    expect(feed.text).toContain('masked already');
  });
});
