import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();

const copyIntoContext = (contextRoot, relativePath) => {
  const source = path.join(repoRoot, relativePath);
  const destination = path.join(contextRoot, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
};

const runBuild = (contextRoot, dockerConfigDir) => {
  const buildEnv = {
    ...process.env,
    BUILDKIT_PROGRESS: 'plain',
    DOCKER_CONFIG: dockerConfigDir,
  };
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) {
    delete buildEnv[name];
  }

  const result = spawnSync(
    'docker',
    [
      'buildx',
      'build',
      '--target',
      'source',
      '--progress=plain',
      '--output=type=cacheonly',
      '--file',
      'docker/all-in-one.Dockerfile',
      '.',
    ],
    {
      cwd: contextRoot,
      encoding: 'utf8',
      env: buildEnv,
      timeout: 20 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'));
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
};

const getStepStatus = (output, stepPattern) => {
  const header = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => stepPattern.test(line));
  assert.ok(header, `missing BuildKit step matching ${stepPattern}`);

  const stepId = header.match(/^#(\d+)/)?.[1];
  assert.ok(stepId, `missing BuildKit step id in ${header}`);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`#${stepId} `));
};

test(
  'all-in-one dependency layer stays cached when only source files change',
  { timeout: 25 * 60 * 1000 },
  () => {
    const contextRoot = mkdtempSync(path.join(os.tmpdir(), 'vanblog-aio-cache-'));
    const dockerConfigDir = mkdtempSync(path.join(os.tmpdir(), 'vanblog-docker-config-'));
    writeFileSync(path.join(dockerConfigDir, 'config.json'), '{}\n');
    try {
      for (const relativePath of [
        'docker/all-in-one.Dockerfile',
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'tsconfig.base.json',
        'patches',
        'packages/server/package.json',
        'packages/website/package.json',
        'packages/admin/package.json',
        'packages/waline/package.json',
        'packages/cli/package.json',
      ]) {
        copyIntoContext(contextRoot, relativePath);
      }

      runBuild(contextRoot, dockerConfigDir);

      const probePath = path.join(contextRoot, 'packages', 'server', 'src', 'cache-probe.txt');
      mkdirSync(path.dirname(probePath), { recursive: true });
      writeFileSync(probePath, `source change ${Date.now()}\n`);

      const secondBuild = runBuild(contextRoot, dockerConfigDir);
      const installStatus = getStepStatus(
        secondBuild,
        /\[dependencies \d+\/\d+\] RUN .*pnpm install --frozen-lockfile/,
      );
      const sourceStatus = getStepStatus(secondBuild, /\[source \d+\/\d+\] COPY \. \.\//);

      assert.ok(
        installStatus.some((line) => line.endsWith(' CACHED')),
        `dependency install should be cached:\n${installStatus.join('\n')}`,
      );
      assert.ok(
        sourceStatus.some((line) => /\bDONE\b/.test(line)),
        `source copy should rerun:\n${sourceStatus.join('\n')}`,
      );
      assert.equal(
        sourceStatus.some((line) => line.endsWith(' CACHED')),
        false,
        `source copy should not stay cached:\n${sourceStatus.join('\n')}`,
      );
    } finally {
      rmSync(contextRoot, { recursive: true, force: true });
      rmSync(dockerConfigDir, { recursive: true, force: true });
    }
  },
);

test('cache test uses the repository all-in-one Dockerfile', () => {
  const dockerfile = readFileSync(path.join(repoRoot, 'docker', 'all-in-one.Dockerfile'), 'utf8');
  assert.match(dockerfile, /FROM node:22\.22\.2-alpine AS dependencies/);
  assert.match(dockerfile, /FROM dependencies AS source/);
  assert.match(dockerfile, /FROM source AS builder/);
});
