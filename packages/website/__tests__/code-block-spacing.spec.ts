import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');

const readRepoFile = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const expectTightCodeBlockSpacing = (relativePath: string) => {
  const css = readRepoFile(relativePath);

  expect(css).toMatch(/code-block-wrapper[\s\S]*?padding:\s*8px 11px 9px;/);
  expect(css).toMatch(/header-right[\s\S]*?top:\s*4px/);
  expect(css).toMatch(/code-content-wrapper[\s\S]*?padding-top:\s*11px;/);
};

describe('code block spacing', () => {
  it('keeps shared light and dark code block spacing in sync', () => {
    [
      'packages/admin/src/style/code-light.css',
      'packages/admin/src/style/code-dark.css',
      'packages/website/styles/code-light.css',
      'packages/website/styles/code-dark.css',
    ].forEach(expectTightCodeBlockSpacing);
  });

  it('keeps the markdown theme hotfix aligned with the shared spacing', () => {
    expectTightCodeBlockSpacing(
      'packages/website/public/markdown-themes/vanblog-theme-hotfix.css',
    );
  });
});
