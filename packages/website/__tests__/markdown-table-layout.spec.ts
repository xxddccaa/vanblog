import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from '../utils/renderMarkdown';

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const expectCenteredScrollableTable = (relativePath: string) => {
  const css = readRepoFile(relativePath);
  const tableRule = css.match(/\.markdown-body table\s*\{[\s\S]*?\}/)?.[0];

  expect(tableRule).toBeDefined();
  expect(tableRule).toMatch(/display:\s*block(?:\s*!important)?;/);
  expect(tableRule).toMatch(/width:\s*fit-content(?:\s*!important)?;/);
  expect(tableRule).toMatch(/max-width:\s*100%(?:\s*!important)?;/);
  expect(tableRule).toMatch(/margin-right:\s*auto(?:\s*!important)?;/);
  expect(tableRule).toMatch(/margin-left:\s*auto(?:\s*!important)?;/);
  expect(tableRule).toMatch(/overflow-x:\s*auto(?:\s*!important)?;/);
};

describe('Markdown table layout', () => {
  it('keeps website, public and admin base table styles aligned', () => {
    [
      'packages/website/styles/github-markdown.css',
      'packages/website/public/markdown.css',
      'packages/admin/src/style/github-markdown.css',
    ].forEach(expectCenteredScrollableTable);
  });

  it('enforces the same layout after optional Markdown themes are loaded', () => {
    expectCenteredScrollableTable(
      'packages/website/public/markdown-themes/vanblog-theme-hotfix.css',
    );
  });

  it('renders both compact and rich Markdown tables without losing structure', () => {
    const html = renderMarkdownToHtml([
      '| 核心问题 | 对应研究方向（英文） | 中文含义与实际要解决的问题 |',
      '|---|---|---|',
      '| Agent 能不能持续把复杂任务做完？ | **Long-Horizon Agent Runtime**<br>**Task State Management** | **长任务运行时。** 解决上下文丢失问题。 |',
      '| Agent 应该怎么做？ | Planning、Decision Policy | 规划与决策。 |',
    ].join('\n'));

    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<strong>Long-Horizon Agent Runtime</strong><br>');
    expect((html.match(/<tr>/g) || []).length).toBe(3);
    expect((html.match(/<td>/g) || []).length).toBe(6);
  });
});
