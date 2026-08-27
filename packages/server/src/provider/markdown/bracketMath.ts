import type MarkdownIt from 'markdown-it';

const BACKSLASH = 0x5c; // \
const OPEN_BRACKET = 0x5b; // [
const OPEN_PAREN = 0x28; // (
const DISPLAY_CLOSE = '\\]';
const INLINE_CLOSE = '\\)';

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

// 块级 \[ ... \]。结构对齐 @vscode/markdown-it-katex 自己的 blockMath：
// 用 state.getLines 取续行，才能正确剥掉 blockquote / 列表的行前缀。
function bracketMathBlock(state: any, start: number, end: number, silent: boolean) {
  let pos = state.bMarks[start] + state.tShift[start];
  const max = state.eMarks[start];

  // 缩进 4 空格以上是 indented code，不是公式
  if (state.sCount[start] - state.blkIndent >= 4) return false;
  if (pos + 2 > max) return false;
  if (state.src.charCodeAt(pos) !== BACKSLASH) return false;
  if (state.src.charCodeAt(pos + 1) !== OPEN_BRACKET) return false;

  pos += 2;

  let firstLine = state.src.slice(pos, max);
  let trailingText = '';
  let lastLine = '';
  let found = false;
  let next = start;

  // 单行写法：\[ ... \]
  const firstLineClose = findUnescapedDelimiter(firstLine, 0, DISPLAY_CLOSE);
  if (firstLineClose !== -1) {
    trailingText = firstLine.slice(firstLineClose + DISPLAY_CLOSE.length);
    firstLine = firstLine.slice(0, firstLineClose);
    found = true;
  }

  if (!found) {
    for (next = start + 1; next < end; next += 1) {
      const linePos = state.bMarks[next] + state.tShift[next];
      const lineMax = state.eMarks[next];

      // 空行结束块级元素：未闭合的 \[ 不能把后面的正文一起吞掉，
      // 这样才和前台 remark 侧的行为一致
      if (state.isEmpty(next)) break;

      // 非空行且负缩进，说明列表已经结束
      if (linePos < lineMax && state.tShift[next] < state.blkIndent) break;

      const line = state.src.slice(linePos, lineMax);
      const closeIndex = findUnescapedDelimiter(line, 0, DISPLAY_CLOSE);

      if (closeIndex !== -1) {
        lastLine = line.slice(0, closeIndex);
        found = true;
        break;
      }
    }
  }

  // 没有结束符就不是公式，保持字面量
  if (!found) return false;

  const content = (
    (firstLine.trim() ? `${firstLine}\n` : '') +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine.trim() ? lastLine : '')
  ).trim();

  if (!content) return false;
  if (silent) return true;

  state.line = next + 1;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.markup = '$$';
  token.content = content;
  token.map = [start, state.line];

  const paragraph = trailingText.trim();
  if (paragraph) {
    const paragraphOpen = state.push('paragraph_open', 'p', 1);
    paragraphOpen.map = [start, state.line];

    const inline = state.push('inline', '', 0);
    inline.content = paragraph;
    inline.map = [start, state.line];
    inline.children = [];

    state.push('paragraph_close', 'p', -1);
  }

  return true;
}

// 行内 \( ... \)
function bracketMathInline(state: any, silent: boolean) {
  const { src, pos } = state;

  if (src.charCodeAt(pos) !== BACKSLASH) return false;
  if (src.charCodeAt(pos + 1) !== OPEN_PAREN) return false;

  const closeIndex = findUnescapedDelimiter(src, pos + 2, INLINE_CLOSE);
  if (closeIndex === -1) return false;

  const formula = src.slice(pos + 2, closeIndex);

  // 行内公式限制在单行内，避免把普通括号当成公式
  if (!formula.trim() || formula.includes('\n')) return false;

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = formula;
  }

  state.pos = closeIndex + INLINE_CLOSE.length;

  return true;
}

/**
 * 让 markdown-it 认识 LaTeX 的 \[...\] / \(...\) 分隔符。
 * 产出的 token 类型与 @vscode/markdown-it-katex 一致，直接复用它的渲染器，
 * 所以必须在 katex 插件之后 use。
 */
export function bracketMath(md: MarkdownIt) {
  md.block.ruler.after('blockquote', 'bracket_math_block', bracketMathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  // 必须排在 escape 之前，否则 `\(` 会先被转义规则吃掉
  md.inline.ruler.before('escape', 'bracket_math_inline', bracketMathInline);
}
