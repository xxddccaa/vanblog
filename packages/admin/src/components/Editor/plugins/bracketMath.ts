import type { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';

const DISPLAY_OPEN = '\\[';
const DISPLAY_CLOSE = '\\]';
const INLINE_OPEN = '\\(';
const INLINE_CLOSE = '\\)';

// 只在这些「只装行内内容」的容器里找公式。
// 不能扫 root/blockquote 这种块级容器，否则会把 A 段的 \[ 和 C 段的 \] 连成一条公式。
const PHRASING_PARENT_TYPES = ['paragraph', 'heading', 'tableCell'];

// 行内代码里的内容保持字面量
const PROTECTED_CHILD_TYPES = ['inlineCode', 'code'];

// CommonMark 里可以被反斜杠转义的 ASCII 标点
const ESCAPED_PUNCTUATION_REGEXP = /\\([!-/:-@[-`{-~])/g;

type Point = { line: number; column: number; offset: number };
type Range = { start: number; end: number };
type Formula = Range & { display: boolean; formula: string };

function countLeadingBackslashes(source: string, index: number) {
  let count = 0;

  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    count += 1;
  }

  return count;
}

function isEscaped(source: string, index: number) {
  return countLeadingBackslashes(source, index) % 2 === 1;
}

// 公式里可能出现 `\\]`（LaTeX 换行紧跟右括号），这种不是结束符
function findUnescapedDelimiter(source: string, start: number, delimiter: string) {
  let index = start;

  while (index < source.length) {
    const matchIndex = source.indexOf(delimiter, index);

    if (matchIndex === -1) {
      return -1;
    }

    if (!isEscaped(source, matchIndex)) {
      return matchIndex;
    }

    index = matchIndex + delimiter.length;
  }

  return -1;
}

// mdast 的 text.value 里转义已经被消解（`\[` -> `[`、`\\` -> `\`），所以公式必须回原文取。
// 代价是公式旁边的普通文字也是原文，需要自己补一次反转义。
function unescapePunctuation(raw: string) {
  return raw.replace(ESCAPED_PUNCTUATION_REGEXP, '$1');
}

// 由已知的起点推算目标偏移的行列，让 sourceHover 这类依赖 position 的插件仍然可用。
function offsetToPoint(source: string, base: Point, offset: number): Point {
  const consumed = source.slice(base.offset, offset);
  const lineBreaks = consumed.split('\n').length - 1;

  if (lineBreaks === 0) {
    return { line: base.line, column: base.column + consumed.length, offset };
  }

  return {
    line: base.line + lineBreaks,
    column: consumed.length - consumed.lastIndexOf('\n'),
    offset,
  };
}

// 块级公式跨行时，原文里的续行还带着容器前缀（blockquote 的 `> `、列表项的缩进），
// 而 mdast 的 value 里已经被剥掉了。这里按公式首行所在的列宽把前缀去掉，
// 只吃空白和 `>`，避免把公式本身的字符吃掉。
function stripContainerPrefix(formula: string, prefixWidth: number) {
  if (prefixWidth <= 0 || !formula.includes('\n')) return formula;

  return formula
    .split('\n')
    .map((line, lineIndex) => {
      if (lineIndex === 0) return line;

      let cursor = 0;
      while (cursor < prefixWidth && cursor < line.length && ' \t>'.includes(line[cursor])) {
        cursor += 1;
      }

      return line.slice(cursor);
    })
    .join('\n');
}

function trimBlockFormula(formula: string) {
  return formula.replace(/^\n+/, '').replace(/\n+$/, '');
}

// 产出与 remark-math 完全同构的节点，交给链上已有的 rehype-katex 渲染
function createMathNode(value: string, display: boolean, position: any) {
  return {
    type: display ? 'math' : 'inlineMath',
    value,
    position,
    data: {
      hName: display ? 'div' : 'span',
      hProperties: { className: ['math', display ? 'math-display' : 'math-inline'] },
      hChildren: [{ type: 'text', value }],
    },
  };
}

function overlaps(ranges: Range[], start: number, end: number) {
  return ranges.some((range) => range.start < end && range.end > start);
}

function findFormulas(source: string, from: number, to: number, protectedRanges: Range[]) {
  const formulas: Formula[] = [];
  let cursor = from;

  while (cursor < to) {
    const display = source.startsWith(DISPLAY_OPEN, cursor);
    const inline = !display && source.startsWith(INLINE_OPEN, cursor);

    if ((display || inline) && !isEscaped(source, cursor)) {
      const closeIndex = findUnescapedDelimiter(
        source,
        cursor + DISPLAY_OPEN.length,
        display ? DISPLAY_CLOSE : INLINE_CLOSE,
      );
      const end = closeIndex + DISPLAY_CLOSE.length;
      const formula =
        closeIndex === -1 ? '' : source.slice(cursor + DISPLAY_OPEN.length, closeIndex);

      if (
        closeIndex !== -1 &&
        // 公式不能越出当前容器，否则会把后面的内容一起吞掉
        end <= to &&
        formula.trim() &&
        // 行内公式限制在单行内，避免把普通括号当成公式
        (display || !formula.includes('\n')) &&
        !overlaps(protectedRanges, cursor, end)
      ) {
        formulas.push({ start: cursor, end, display, formula });
        cursor = end;
        continue;
      }
    }

    cursor += 1;
  }

  return formulas;
}

// 取 [from, to) 这段里原有的子节点。公式内部的节点直接丢掉——
// 公式内容以原文为准，所以像 `~b~`、`[a](b)`、`:foo` 这类被
// markdown 解析成别的行内节点的内容不会破坏公式。
function collectSegmentChildren(
  children: any[],
  from: number,
  to: number,
  source: string,
  base: Point,
) {
  if (to <= from) return [];

  const kept: any[] = [];

  for (const child of children) {
    const start = child.position.start.offset;
    const end = child.position.end.offset;

    if (end <= from || start >= to) continue;
    if (start >= from && end <= to) {
      kept.push(child);
      continue;
    }

    // text 节点跨越公式边界时，按边界切开
    if (child.type === 'text') {
      const sliceStart = Math.max(start, from);
      const sliceEnd = Math.min(end, to);

      if (sliceEnd > sliceStart) {
        kept.push({
          type: 'text',
          value: unescapePunctuation(source.slice(sliceStart, sliceEnd)),
          position: {
            start: offsetToPoint(source, base, sliceStart),
            end: offsetToPoint(source, base, sliceEnd),
          },
        });
      }
    }
  }

  return kept;
}

function convertPhrasingParent(parent: any, source: string) {
  const children: any[] = parent.children || [];
  if (!children.length) return;

  // 只要有节点缺位置信息就整块跳过，宁可不转换也不要错切
  if (
    children.some(
      (child) =>
        child.position?.start?.offset === undefined || child.position?.end?.offset === undefined,
    )
  ) {
    return;
  }

  const base: Point = children[0].position.start;
  const from = base.offset;
  const to = children[children.length - 1].position.end.offset;

  const protectedRanges: Range[] = children
    .filter((child) => PROTECTED_CHILD_TYPES.includes(child.type))
    .map((child) => ({ start: child.position.start.offset, end: child.position.end.offset }));

  const formulas = findFormulas(source, from, to, protectedRanges);
  if (!formulas.length) return;

  const rebuilt: any[] = [];
  let cursor = from;

  for (const item of formulas) {
    rebuilt.push(...collectSegmentChildren(children, cursor, item.start, source, base));

    const start = offsetToPoint(source, base, item.start);
    const value = item.display
      ? trimBlockFormula(stripContainerPrefix(item.formula, start.column - 1))
      : item.formula;

    rebuilt.push(
      createMathNode(value, item.display, {
        start,
        end: offsetToPoint(source, base, item.end),
      }),
    );

    cursor = item.end;
  }

  rebuilt.push(...collectSegmentChildren(children, cursor, to, source, base));
  parent.children = rebuilt;
}

function isBlankText(node: any) {
  return node.type === 'text' && node.value.trim() === '';
}

// 块级公式不能留在段落里，否则会产出 <p><div class="math math-display"> 这种非法嵌套
function liftDisplayMath(tree: any) {
  visit(tree, 'paragraph', (node: any, index: number | undefined, parent: any) => {
    if (index === undefined || !parent) return;
    if (!node.children?.some((child: any) => child.type === 'math')) return;

    const siblings: any[] = [];
    let inlineChildren: any[] = [];

    const flushParagraph = () => {
      if (inlineChildren.some((child) => !isBlankText(child))) {
        siblings.push({ type: 'paragraph', children: inlineChildren });
      }
      inlineChildren = [];
    };

    for (const child of node.children) {
      if (child.type === 'math') {
        flushParagraph();
        siblings.push(child);
      } else {
        inlineChildren.push(child);
      }
    }

    flushParagraph();
    parent.children.splice(index, 1, ...siblings);

    return (index + siblings.length) as any;
  });
}

/**
 * 让 remark 认识 LaTeX 的 \[...\] / \(...\) 分隔符。
 *
 * 公式内容一律回原始 markdown 取，因为 mdast 的 text.value 已经消解过转义，
 * 直接用它会把 `\\`（LaTeX 换行）之类的写法吃掉。围栏代码、缩进代码、行内代码
 * 在 mdast 里是独立节点，不在扫描范围内，所以天然保持字面量。
 *
 * 必须排在会改写 text 节点的插件（customContainer / extendedSyntax）之前。
 */
function remarkBracketMath() {
  return (tree: any, file: any) => {
    const source = String(file);

    if (!source.includes(DISPLAY_OPEN) && !source.includes(INLINE_OPEN)) {
      return;
    }

    visit(tree, (node: any) => {
      if (!PHRASING_PARENT_TYPES.includes(node.type)) return;
      convertPhrasingParent(node, source);
    });

    liftDisplayMath(tree);
  };
}

export { remarkBracketMath };

export function bracketMathPlugin(): BytemdPlugin {
  return {
    remark: (processor) => processor.use(remarkBracketMath as any),
  };
}
