import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const simpleMindMapDir = path.join(repoRoot, 'mind-map', 'simple-mind-map');
const mindMapWebDir = path.join(repoRoot, 'mind-map', 'web');
const mindMapDistDir = path.join(repoRoot, 'mind-map', 'dist');
const adminMindMapDir = path.join(repoRoot, 'packages', 'admin', 'dist', 'mindmap');

const run = (command, args, cwd, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
};

const ensureInstalled = (cwd) => {
  if (!existsSync(path.join(cwd, 'node_modules'))) {
    run('npm', ['install'], cwd);
  }
};

const buildMindMapAssets = () => {
  ensureInstalled(simpleMindMapDir);
  ensureInstalled(mindMapWebDir);
  run('npm', ['install', '--no-save', '../simple-mind-map'], mindMapWebDir);

  const nodeOptions = process.env.NODE_OPTIONS || '';
  const nextNodeOptions = `${nodeOptions} --openssl-legacy-provider`.trim();
  const buildIndexDir = mkdtempSync(path.join(os.tmpdir(), 'vanblog-mindmap-'));
  const buildIndexPath = path.join(buildIndexDir, 'index.html');
  try {
    run('npm', ['run', 'build'], mindMapWebDir, {
      NODE_OPTIONS: nextNodeOptions,
      MIND_MAP_INDEX_DEST: buildIndexPath,
    });
    return { buildIndexDir, buildIndexPath };
  } catch (error) {
    rmSync(buildIndexDir, { recursive: true, force: true });
    throw error;
  }
};

const hardenMindMapScriptsForCsp = (indexPath) => {
  let html = readFileSync(indexPath, 'utf8');
  // Do not ship the upstream analytics loader inside the authenticated admin
  // origin. It is unrelated to VanBlog and cannot be safely allowlisted.
  html = html.replace(
    /<script[^>]*id=["']LA_COLLECT["'][^>]*><\/script>\s*<script>[\s\S]*?LA\.init\([\s\S]*?<\/script>/i,
    '',
  );

  const scriptDir = path.join(mindMapDistDir, 'js');
  mkdirSync(scriptDir, { recursive: true });
  html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (fullMatch, attributes, source) => {
    if (/\bsrc\s*=/i.test(attributes) || !source.trim()) {
      return fullMatch;
    }
    const sourceText = `${source.trim()}\n`;
    const digest = createHash('sha256').update(sourceText).digest('hex').slice(0, 16);
    const fileName = `vanblog-inline-${digest}.js`;
    writeFileSync(path.join(scriptDir, fileName), sourceText, {
      mode: 0o644,
    });
    return `<script${attributes} src="dist/js/${fileName}"></script>`;
  });
  writeFileSync(indexPath, html);
};

const syncMindMapAssetsToAdmin = (indexPath) => {
  if (!existsSync(mindMapDistDir) || !existsSync(indexPath)) {
    throw new Error('Mindmap build output is missing after build step');
  }

  rmSync(adminMindMapDir, { recursive: true, force: true });
  mkdirSync(adminMindMapDir, { recursive: true });
  cpSync(mindMapDistDir, path.join(adminMindMapDir, 'dist'), { recursive: true });
  cpSync(indexPath, path.join(adminMindMapDir, 'index.html'));
};

const { buildIndexDir, buildIndexPath } = buildMindMapAssets();
try {
  hardenMindMapScriptsForCsp(buildIndexPath);
  syncMindMapAssetsToAdmin(buildIndexPath);
} finally {
  rmSync(buildIndexDir, { recursive: true, force: true });
}
console.log('[build-mindmap-assets] synced mindmap assets into packages/admin/dist/mindmap');
