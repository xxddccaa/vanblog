import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createPublicStaticGuard, isPublicStaticPathAllowed } from './public-static.middleware';

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
