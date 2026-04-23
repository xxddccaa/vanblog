import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCodeBlockSnippet,
  buildCustomContainerSnippet,
  buildImageMarkdown,
  buildLinkSnippet,
  buildMathBlockSnippet,
  buildMoreSnippet,
  buildTaskListSnippet,
  insertTextAtRange,
  resolveEditorEngine,
} from '../packages/admin/src/components/MarkdownEditor/utils.ts';
import {
  consumeMarkdownUpdate,
  shouldSyncExternalMarkdown,
} from '../packages/admin/src/components/MarkdownEditor/sync.ts';
import { normalizeMathDelimiters } from '../packages/admin/src/components/Editor/plugins/normalizeMathDelimiters.ts';

test('markdown editor snippet builders keep expected markdown syntax', () => {
  assert.equal(resolveEditorEngine(null), 'milkdown');
  assert.equal(resolveEditorEngine('bytemd'), 'bytemd');
  assert.equal(buildMoreSnippet(), '<!-- more -->\n');
  assert.equal(
    buildCustomContainerSnippet('info'),
    ':::info{title="相关信息"}\n相关信息\n:::',
  );
  assert.equal(buildCodeBlockSnippet('mermaid'), '```mermaid\n\n```');
  assert.equal(buildTaskListSnippet(), '- [ ] 待办事项');
  assert.equal(buildMathBlockSnippet(), '$$\n\n$$');
  assert.equal(
    buildImageMarkdown('https://img.test/demo.png', 'demo', '示例图'),
    '![demo](https://img.test/demo.png "示例图")',
  );
  assert.equal(buildLinkSnippet('iframe', 'https://example.com/embed'), '[iframe](https://example.com/embed)');
});

test('markdown editor insertion helper applies toolbar text at the cursor', () => {
  const result = insertTextAtRange('hello world', { start: 6, end: 11 }, '😊');
  assert.equal(result.value, 'hello 😊');
  assert.deepEqual(result.selection, { start: 8, end: 8 });
});

test('markdown editor sync helpers avoid controlled update loops', () => {
  assert.equal(shouldSyncExternalMarkdown('next', 'prev'), true);
  assert.equal(shouldSyncExternalMarkdown('same', 'same'), false);

  const suppressed = consumeMarkdownUpdate(
    {
      currentMarkdown: 'server value',
      suppressNextChange: true,
    },
    'server value',
  );
  assert.equal(suppressed.shouldEmit, false);
  assert.deepEqual(suppressed.state, {
    currentMarkdown: 'server value',
    suppressNextChange: false,
  });

  const emitted = consumeMarkdownUpdate(
    {
      currentMarkdown: 'before',
      suppressNextChange: false,
    },
    'after',
  );
  assert.equal(emitted.shouldEmit, true);
  assert.deepEqual(emitted.state, {
    currentMarkdown: 'after',
    suppressNextChange: false,
  });
});

test('normalizeMathDelimiters preserves non-math markdown while converting formulas', () => {
  const source = [
    '正文 \\(E=mc^2\\)',
    '',
    '<iframe src="https://example.com/embed"></iframe>',
    '',
    '```mermaid',
    'graph TD',
    'A-->B',
    '```',
  ].join('\n');

  assert.equal(
    normalizeMathDelimiters(source),
    [
      '正文 $E=mc^2$',
      '',
      '<iframe src="https://example.com/embed"></iframe>',
      '',
      '```mermaid',
      'graph TD',
      'A-->B',
      '```',
    ].join('\n'),
  );
});
