import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const trackedIndexPath = path.join(repoRoot, 'mind-map', 'index.html');
const adminMindMapDir = path.join(repoRoot, 'packages', 'admin', 'dist', 'mindmap');

const sha256 = (content) => createHash('sha256').update(content).digest('hex');

test(
  'mindmap admin build preserves the tracked shell and emits content-hashed assets',
  { timeout: 15 * 60 * 1000 },
  () => {
    const trackedIndexBefore = readFileSync(trackedIndexPath);
    const result = spawnSync(process.execPath, ['scripts/build-mindmap-assets.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
      timeout: 14 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    });

    assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));

    const trackedIndexAfter = readFileSync(trackedIndexPath);
    assert.equal(sha256(trackedIndexAfter), sha256(trackedIndexBefore));

    const builtIndex = readFileSync(path.join(adminMindMapDir, 'index.html'), 'utf8');
    const assetUrls = [
      ...builtIndex.matchAll(/(?:src|href)="(dist\/(?:js|css)\/[^"]+\.(?:js|css))"/g),
    ].map((match) => match[1]);

    assert.ok(assetUrls.length >= 4, 'mindmap shell should reference built JS and CSS');
    assert.doesNotMatch(builtIndex, /(?:src|href)="[^"]+\.(?:js|css)\?[^"]+"/);

    for (const assetUrl of assetUrls) {
      assert.match(
        path.basename(assetUrl),
        /(?:^|[-.])[0-9a-f]{8,}\.(?:js|css)$/,
        `${assetUrl} should contain a content hash`,
      );
      assert.ok(
        statSync(path.join(adminMindMapDir, assetUrl)).isFile(),
        `${assetUrl} should exist`,
      );
    }

    const inlineUrls = assetUrls.filter((assetUrl) =>
      path.basename(assetUrl).startsWith('vanblog-inline-'),
    );
    assert.ok(inlineUrls.length >= 2, 'inline scripts should be extracted for CSP');

    for (const assetUrl of inlineUrls) {
      const source = readFileSync(path.join(adminMindMapDir, assetUrl));
      const expectedHash = sha256(source).slice(0, 16);
      assert.equal(path.basename(assetUrl), `vanblog-inline-${expectedHash}.js`);
    }
  },
);

test('mindmap shell and hashed assets use distinct cache policies', () => {
  const nginxConfig = readFileSync(
    path.join(repoRoot, 'packages', 'admin', 'default.conf'),
    'utf8',
  );
  const editorSource = readFileSync(
    path.join(repoRoot, 'packages', 'admin', 'src', 'pages', 'MindMap', 'editor.jsx'),
    'utf8',
  );

  assert.match(
    nginxConfig,
    /location = \/admin\/mindmap\/index\.html \{[\s\S]*?Cache-Control "no-store, no-cache, must-revalidate"/,
  );
  assert.match(
    nginxConfig,
    /location ~\* \^\/admin\/\.\*\\\.\(\?:js\|css[\s\S]*?Cache-Control "public, max-age=31536000, immutable"/,
  );
  assert.match(editorSource, /src="\/admin\/mindmap\/index\.html"/);
  assert.doesNotMatch(editorSource, /iframeCacheBuster|Date\.now\(\)/);
});
