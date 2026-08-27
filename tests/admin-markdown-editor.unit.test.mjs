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
import { remarkBracketMath } from '../packages/admin/src/components/Editor/plugins/bracketMath.ts';

test('markdown editor snippet builders keep expected markdown syntax', () => {
  assert.equal(resolveEditorEngine(null), 'bytemd');
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

// mdast 的 text.value 里转义已经被消解，所以插件必须回原文取公式。
// 这里手搭一棵与 remark-parse 产物一致的树，避免在这个用例里拉起整套 bytemd。
function paragraphTree(text, position) {
  return {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: text, position }] }],
  };
}

test('bracketMath lifts \\[...\\] out of the paragraph as display math', () => {
  const source = ['\\[', 'Q,\\quad R', '\\]'].join('\n');
  const tree = paragraphTree('[\nQ,\\quad R\n]', {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 3, column: 3, offset: source.length },
  });

  remarkBracketMath()(tree, source);

  assert.equal(tree.children.length, 1);
  const [math] = tree.children;
  assert.equal(math.type, 'math');
  // 关键：`\quad` 的反斜杠必须是原文里的那一个
  assert.equal(math.value, 'Q,\\quad R');
  assert.equal(math.data.hName, 'div');
  assert.deepEqual(math.data.hProperties.className, ['math', 'math-display']);
});

test('bracketMath keeps \\(...\\) inline and leaves surrounding text intact', () => {
  const source = '前 \\(a+b\\) 后';
  const tree = paragraphTree('前 (a+b) 后', {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 12, offset: source.length },
  });

  remarkBracketMath()(tree, source);

  const { children } = tree.children[0];
  assert.deepEqual(
    children.map((node) => node.type),
    ['text', 'inlineMath', 'text'],
  );
  assert.equal(children[0].value, '前 ');
  assert.equal(children[1].value, 'a+b');
  assert.equal(children[1].data.hName, 'span');
  assert.equal(children[2].value, ' 后');
});
