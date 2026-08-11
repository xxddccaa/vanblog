import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const simpleMindMapDir = path.join(repoRoot, 'mind-map', 'simple-mind-map');
const mindMapWebDir = path.join(repoRoot, 'mind-map', 'web');
const mindMapDistDir = path.join(repoRoot, 'mind-map', 'dist');
const mindMapIndexPath = path.join(repoRoot, 'mind-map', 'index.html');
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
  run('npm', ['run', 'build'], mindMapWebDir, {
    NODE_OPTIONS: nextNodeOptions,
  });
};

const hardenMindMapScriptsForCsp = () => {
  let html = readFileSync(mindMapIndexPath, 'utf8');
  // Do not ship the upstream analytics loader inside the authenticated admin
  // origin. It is unrelated to VanBlog and cannot be safely allowlisted.
  html = html.replace(
    /<script[^>]*id=["']LA_COLLECT["'][^>]*><\/script>\s*<script>[\s\S]*?LA\.init\([\s\S]*?<\/script>/i,
    '',
  );

  const scriptDir = path.join(mindMapDistDir, 'js');
  mkdirSync(scriptDir, { recursive: true });
  let inlineIndex = 0;
  html = html.replace(
    /<script([^>]*)>([\s\S]*?)<\/script>/gi,
    (fullMatch, attributes, source) => {
      if (/\bsrc\s*=/i.test(attributes) || !source.trim()) {
        return fullMatch;
      }
      const fileName = `vanblog-inline-${inlineIndex++}.js`;
      writeFileSync(path.join(scriptDir, fileName), `${source.trim()}\n`, {
        mode: 0o644,
      });
      return `<script${attributes} src="dist/js/${fileName}"></script>`;
    },
  );
  writeFileSync(mindMapIndexPath, html);
};

const syncMindMapAssetsToAdmin = () => {
  if (!existsSync(mindMapDistDir) || !existsSync(mindMapIndexPath)) {
    throw new Error('Mindmap build output is missing after build step');
  }

  rmSync(adminMindMapDir, { recursive: true, force: true });
  mkdirSync(adminMindMapDir, { recursive: true });
  cpSync(mindMapDistDir, path.join(adminMindMapDir, 'dist'), { recursive: true });
  cpSync(mindMapIndexPath, path.join(adminMindMapDir, 'index.html'));
};

buildMindMapAssets();
hardenMindMapScriptsForCsp();
syncMindMapAssetsToAdmin();
console.log('[build-mindmap-assets] synced mindmap assets into packages/admin/dist/mindmap');
