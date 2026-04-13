#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const requiredKeys = ['request', 'getInitialState', 'initialStateConfig'];

function patchFile(filePath, replacer) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const next = replacer(original);
  if (next === original) {
    return false;
  }

  fs.writeFileSync(filePath, next);
  return true;
}

function appendMissingKeys(serializedList, quote) {
  const existing = new Set(
    [...serializedList.matchAll(new RegExp(`${quote}([^${quote}]+)${quote}`, 'g'))].map(
      (match) => match[1],
    ),
  );
  const missing = requiredKeys.filter((key) => !existing.has(key));
  if (missing.length === 0) {
    return serializedList;
  }
  const suffix = missing.map((key) => `${quote}${key}${quote}`).join(',');
  return `${serializedList},${suffix}`;
}

function patchSourcePlugin(filePath) {
  return patchFile(filePath, (source) =>
    source.replace(
      /export function getValidKeys\(\) \{\s*return \[(.*?)\];\s*\}/s,
      (full, list) =>
        `export function getValidKeys() {\n  return [${appendMissingKeys(list, "'")}];\n}`,
    ),
  );
}

function patchBuiltBundle(filePath) {
  return patchFile(filePath, (source) => {
    if (source.includes('"qiankun","request","getInitialState","initialStateConfig"]')) {
      return source;
    }

    return source.replace(
      /"qiankun"\]\}var ([A-Za-z_$][\w$]*)=null;function ([A-Za-z_$][\w$]*)\(\)/,
      '"qiankun","request","getInitialState","initialStateConfig"]}var $1=null;function $2()',
    );
  });
}

const sourcePluginPath = path.join(repoRoot, 'packages/admin/src/.umi-production/core/plugin.ts');
const distDir = path.join(repoRoot, 'packages/admin/dist');
const distBundle = fs.existsSync(distDir)
  ? fs
      .readdirSync(distDir)
      .find((entry) => /^umi\..+\.js$/.test(entry))
  : null;

let changed = false;
changed = patchSourcePlugin(sourcePluginPath) || changed;

if (distBundle) {
  changed = patchBuiltBundle(path.join(distDir, distBundle)) || changed;
}

if (!changed) {
  console.log('[patch-admin-runtime-keys] no changes needed');
} else {
  console.log('[patch-admin-runtime-keys] patched admin runtime keys');
}
