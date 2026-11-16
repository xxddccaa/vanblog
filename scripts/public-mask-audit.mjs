#!/usr/bin/env node
/**
 * Public mask audit: crawls everything an anonymous visitor can fetch and fails if
 * any masked term shows up, in raw, percent-encoded, JSON-escaped, HTML-entity, or
 * base64 form.
 *
 * Terms are secrets, so they are read from the environment (or a file outside the
 * repository) and never printed; findings refer to them as term#1, term#2, ...
 *
 *   VANBLOG_AUDIT_BASE=http://127.0.0.1:8020 \
 *   VANBLOG_AUDIT_TERMS='first,second' \
 *   node scripts/public-mask-audit.mjs
 *
 * Options (environment):
 *   VANBLOG_AUDIT_TERMS_FILE  file with one term per line, instead of VANBLOG_AUDIT_TERMS
 *   VANBLOG_AUDIT_MAX_PAGES   maximum HTML pages from the sitemap (default 200)
 *   VANBLOG_AUDIT_MAX_ITEMS   maximum articles/tags/categories probed per list (default 100)
 */
import { readFileSync } from 'node:fs';

const base = String(process.env.VANBLOG_AUDIT_BASE || 'http://127.0.0.1:8020').replace(/\/+$/, '');
const maxPages = Number(process.env.VANBLOG_AUDIT_MAX_PAGES || 200);
const maxItems = Number(process.env.VANBLOG_AUDIT_MAX_ITEMS || 100);

const loadTerms = () => {
  const raw = process.env.VANBLOG_AUDIT_TERMS_FILE
    ? readFileSync(process.env.VANBLOG_AUDIT_TERMS_FILE, 'utf8')
    : process.env.VANBLOG_AUDIT_TERMS || '';
  return [...new Set(raw.split(/[\n,]/).map((term) => term.trim()).filter((term) => term.length >= 2))];
};

const terms = loadTerms();
if (!terms.length) {
  console.error('No terms given. Set VANBLOG_AUDIT_TERMS or VANBLOG_AUDIT_TERMS_FILE.');
  process.exit(2);
}

const encodeEntities = (term) =>
  [...term].map((char) => `&#x${char.codePointAt(0).toString(16)};`).join('');
const encodeJsonEscapes = (term) =>
  [...term]
    .map((char) => (char.charCodeAt(0) > 0x7f ? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}` : char))
    .join('');

const termForms = terms.map((term, index) => ({
  label: `term#${index + 1}`,
  forms: [
    ['raw', term.toLowerCase()],
    ['percent-encoded', encodeURIComponent(term).toLowerCase()],
    ['json-escaped', encodeJsonEscapes(term).toLowerCase()],
    ['html-entity', encodeEntities(term).toLowerCase()],
  ].filter(([, value], position, all) => all.findIndex(([, other]) => other === value) === position),
}));

const BASE64_BLOB = /[A-Za-z0-9+/]{24,}={0,2}/g;

const findTerms = (text) => {
  const found = [];
  const lower = text.toLowerCase();
  for (const { label, forms } of termForms) {
    for (const [form, value] of forms) {
      if (lower.includes(value)) {
        found.push(`${label} (${form})`);
      }
    }
  }
  // Base64 payloads, e.g. custom HTML, layout code, or data URIs.
  for (const blob of text.match(BASE64_BLOB) || []) {
    if (blob.length > 4 * 1024 * 1024) {
      continue;
    }
    const decoded = Buffer.from(blob, 'base64').toString('utf8').toLowerCase();
    for (const { label, forms } of termForms) {
      if (decoded.includes(forms[0][1])) {
        found.push(`${label} (base64)`);
      }
    }
  }
  return [...new Set(found)];
};

const findings = [];
const visited = new Set();
let requests = 0;

const fetchText = async (url, headers = {}) => {
  requests += 1;
  try {
    const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    const location = response.headers.get('location') || '';
    const body = await response.text();
    return { status: response.status, text: `${location}\n${body}` };
  } catch (error) {
    return { status: 0, text: '', error: error.message };
  }
};

const audit = async (path, headers = {}) => {
  const key = `${path}|${JSON.stringify(headers)}`;
  if (visited.has(key)) {
    return null;
  }
  visited.add(key);
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const result = await fetchText(url, headers);
  const hits = findTerms(result.text);
  if (hits.length) {
    findings.push({ path, headers: Object.keys(headers).join(',') || '-', status: result.status, hits });
  }
  return result;
};

const auditJson = async (path) => {
  const result = await audit(path);
  if (!result || result.status !== 200) {
    return null;
  }
  try {
    return JSON.parse(result.text.slice(result.text.indexOf('\n') + 1));
  } catch {
    return null;
  }
};

const runPool = async (items, worker, size = 4) => {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (queue.length) {
        await worker(queue.shift());
      }
    }),
  );
};

const enc = (value) => encodeURIComponent(String(value));

const main = async () => {
  console.log(`Auditing ${base} for ${terms.length} term(s)...`);

  // 1. Generated artifacts.
  for (const path of ['/feed.xml', '/feed.json', '/atom.xml', '/sitemap.xml', '/static/search-index.json']) {
    await audit(path);
  }

  // 2. Public API listings.
  const meta = await auditJson('/api/public/meta');
  for (const path of [
    '/API/PUBLIC/meta',
    '/api/public/site-info',
    '/api/public/site-stats',
    '/api/public/customPage/all',
    '/api/public/timeline',
    '/api/public/timeline/summary',
    '/api/public/category',
    '/api/public/category/summary',
    '/api/public/tags/all',
    '/api/public/tags/hot?limit=50',
    '/api/public/tags/paginated?page=1&pageSize=100&sortBy=name&sortOrder=asc',
    '/api/public/archive/summary',
    '/api/public/moment?page=1&pageSize=100',
    '/api/public/nav/data',
    '/api/public/nav/admin-data',
    '/api/public/icon',
    '/api/public/music/setting',
    '/api/public/music/list',
    '/api/public/viewer',
  ]) {
    await audit(path);
  }
  const list = await auditJson(`/api/public/article?page=1&pageSize=100&withPreviewContent=true`);
  await audit('/api/public/article?page=1&pageSize=100&toListView=true&withWordCount=true');
  const articles = (list?.data?.articles || []).slice(0, maxItems);

  // 3. Per-article endpoints.
  await runPool(articles, async (article) => {
    const id = article.pathname || article.id;
    for (const suffix of ['', '/nav', '/fragments', '/engagement']) {
      await audit(`/api/public/article/${enc(id)}${suffix}`);
    }
  });

  // 4. Taxonomy and archive endpoints, using names exactly as the public site sees them.
  const tags = (meta?.data?.tags || []).slice(0, maxItems);
  const categories = (meta?.data?.meta?.categories || []).slice(0, maxItems);
  await runPool(tags, async (tag) => {
    await audit(`/api/public/tag-articles/${enc(tag)}`);
    await audit(`/api/public/tag/${enc(tag)}/archive/summary`);
  });
  await runPool(categories, async (category) => {
    const name = typeof category === 'string' ? category : category?.name;
    await audit(`/api/public/category/${enc(name)}/articles`);
    await audit(`/api/public/category/${enc(name)}/archive/summary`);
  });
  const timeline = await auditJson('/api/public/timeline/summary');
  for (const entry of (timeline?.data || []).slice(0, 20)) {
    if (entry?.year) {
      await audit(`/api/public/timeline/${enc(entry.year)}/articles`);
    }
  }

  // 5. Custom pages.
  const customPages = await auditJson('/api/public/customPage/all');
  for (const page of (customPages?.data || []).slice(0, maxItems)) {
    if (page?.path) {
      await audit(`/c${page.path}${page.type === 'folder' ? '/' : ''}`);
      await audit(`/api/public/customPage?path=${enc(page.path)}`);
    }
  }

  // 6. HTML pages from the sitemap, their RSC payloads, and the scripts they load.
  const sitemap = await fetchText(`${base}/sitemap.xml`);
  const pageUrls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]).pathname)
    .slice(0, maxPages);
  const scripts = new Set();
  await runPool(['/', '/about', '/link', '/moment', '/nav', '/tag', '/category', '/timeline', ...pageUrls], async (path) => {
    const page = await audit(path);
    await audit(path, { RSC: '1' });
    for (const match of (page?.text || '').matchAll(/["'](\/_next\/static\/[^"']+\.js)["']/g)) {
      scripts.add(match[1]);
    }
  });
  await runPool([...scripts], (script) => audit(script));

  // 7. Probing with terms must look exactly like probing with a name that does not exist.
  const probe = async (template, value) => (await fetchText(`${base}${template.replace('%s', enc(value))}`));
  const nonce = `audit-missing-${Date.now()}`;
  for (const [index, term] of terms.entries()) {
    for (const template of [
      '/api/public/search?value=%s',
      '/api/public/tag-articles/%s',
      '/api/public/category/%s/articles',
      '/api/public/article/%s',
      '/api/public/tags/paginated?page=1&pageSize=10&search=%s',
    ]) {
      for (const value of [term, term.slice(0, Math.max(2, term.length - 2))]) {
        const [withTerm, withNonce] = await Promise.all([probe(template, value), probe(template, nonce)]);
        const normalize = (text) => text.split(nonce).join('').split(value).join('');
        if (withTerm.status !== withNonce.status || normalize(withTerm.text) !== normalize(withNonce.text)) {
          findings.push({
            path: template.replace('%s', `<term#${index + 1}${value === term ? '' : ' prefix'}>`),
            headers: '-',
            status: withTerm.status,
            hits: ['response differs from a missing value (possible oracle)'],
          });
        }
      }
    }
  }

  console.log(`Requests: ${requests}`);
  if (!findings.length) {
    console.log('No masked terms found in public output.');
    return;
  }
  console.log(`Found ${findings.length} leak(s):`);
  for (const finding of findings) {
    console.log(`- [${finding.status}] ${finding.path} (headers: ${finding.headers}): ${finding.hits.join(', ')}`);
  }
  process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
