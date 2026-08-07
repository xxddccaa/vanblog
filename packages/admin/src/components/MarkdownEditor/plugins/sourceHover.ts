import type { BytemdPlugin } from 'bytemd';

const SOURCE_START_PROPERTY = 'dataVbSourceStart';
const SOURCE_END_PROPERTY = 'dataVbSourceEnd';
const SOURCE_START_ATTRIBUTE = 'data-vb-source-start';
const SOURCE_END_ATTRIBUTE = 'data-vb-source-end';
const SOURCE_BLOCK_SELECTOR = `[${SOURCE_START_ATTRIBUTE}][${SOURCE_END_ATTRIBUTE}]`;
const ACTIVE_CLASS_NAME = 'vb-source-hover-active';
const BLOCK_TAG_NAMES = new Set([
  'blockquote',
  'details',
  'div',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'p',
  'pre',
  'table',
]);
const TEXT_BLOCK_TAG_NAMES = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P']);
const CONTAINER_BLOCK_SELECTOR = [
  `blockquote${SOURCE_BLOCK_SELECTOR}`,
  `details${SOURCE_BLOCK_SELECTOR}`,
  `div${SOURCE_BLOCK_SELECTOR}`,
  `figure${SOURCE_BLOCK_SELECTOR}`,
  `li${SOURCE_BLOCK_SELECTOR}`,
  `table${SOURCE_BLOCK_SELECTOR}`,
].join(',');

type SourcePosition = {
  start?: {
    line?: number;
  };
  end?: {
    line?: number;
  };
};

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: SourcePosition;
  children?: HastNode[];
};

export type SourceBlockRange = {
  startLine: number;
  endLine: number;
  depth?: number;
  priority?: number;
};

type PreviewBlock = SourceBlockRange & {
  depth: number;
  priority: number;
  element: HTMLElement;
};

function isPositiveLine(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function annotateSourceBlockTree(tree: HastNode) {
  const visitNode = (node: HastNode) => {
    const startLine = node.position?.start?.line;
    const endLine = node.position?.end?.line;

    if (
      node.type === 'element' &&
      node.tagName &&
      BLOCK_TAG_NAMES.has(node.tagName) &&
      isPositiveLine(startLine) &&
      isPositiveLine(endLine)
    ) {
      node.properties ??= {};
      node.properties[SOURCE_START_PROPERTY] = String(startLine);
      node.properties[SOURCE_END_PROPERTY] = String(endLine);
    }

    node.children?.forEach(visitNode);
  };

  visitNode(tree);
}

export function parseSourceBlockRange(
  startValue?: string | null,
  endValue?: string | null,
): SourceBlockRange | null {
  const startLine = Number(startValue);
  const endLine = Number(endValue);

  if (!isPositiveLine(startLine) || !isPositiveLine(endLine) || endLine < startLine) {
    return null;
  }

  return {
    startLine,
    endLine,
  };
}

export function findBestSourceBlock<T extends SourceBlockRange>(
  blocks: T[],
  sourceLine: number,
): T | null {
  return (
    blocks
      .filter((block) => block.startLine <= sourceLine && block.endLine >= sourceLine)
      .sort((left, right) => {
        const leftSpan = left.endLine - left.startLine;
        const rightSpan = right.endLine - right.startLine;

        return (
          leftSpan - rightSpan ||
          (right.priority || 0) - (left.priority || 0) ||
          (right.depth || 0) - (left.depth || 0)
        );
      })[0] || null
  );
}

export function isBlockOutsideViewport(
  block: Pick<DOMRect, 'top' | 'bottom'>,
  viewport: Pick<DOMRect, 'top' | 'bottom'>,
) {
  return block.bottom <= viewport.top || block.top >= viewport.bottom;
}

function getBlockPriority(element: HTMLElement) {
  const priorities: Record<string, number> = {
    PRE: 80,
    TABLE: 75,
    DIV: 70,
    FIGURE: 70,
    DETAILS: 65,
    LI: 60,
    BLOCKQUOTE: 55,
    HR: 50,
    H1: 45,
    H2: 45,
    H3: 45,
    H4: 45,
    H5: 45,
    H6: 45,
    P: 40,
  };

  return priorities[element.tagName] || 0;
}

function getElementDepth(element: HTMLElement, root: HTMLElement) {
  let depth = 0;
  let current: HTMLElement | null = element;

  while (current && current !== root) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
}

function isNestedTextBlock(element: HTMLElement, root: HTMLElement) {
  if (!TEXT_BLOCK_TAG_NAMES.has(element.tagName)) {
    return false;
  }

  const container = element.parentElement?.closest<HTMLElement>(CONTAINER_BLOCK_SELECTOR);
  return Boolean(container && root.contains(container));
}

function collectPreviewBlocks(root: HTMLElement): PreviewBlock[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SOURCE_BLOCK_SELECTOR))
    .filter((element) => !isNestedTextBlock(element, root))
    .map((element) => {
      const range = parseSourceBlockRange(
        element.getAttribute(SOURCE_START_ATTRIBUTE),
        element.getAttribute(SOURCE_END_ATTRIBUTE),
      );

      if (!range) {
        return null;
      }

      return {
        ...range,
        depth: getElementDepth(element, root),
        priority: getBlockPriority(element),
        element,
      };
    })
    .filter((block): block is PreviewBlock => Boolean(block));
}

function copySourceRange(from: Element, to: Element) {
  const startLine = from.getAttribute(SOURCE_START_ATTRIBUTE);
  const endLine = from.getAttribute(SOURCE_END_ATTRIBUTE);

  if (!startLine || !endLine) {
    return false;
  }

  to.setAttribute(SOURCE_START_ATTRIBUTE, startLine);
  to.setAttribute(SOURCE_END_ATTRIBUTE, endLine);
  return true;
}

function annotateSourceBlocks() {
  return (tree: HastNode) => {
    annotateSourceBlockTree(tree);
  };
}

export function sourceHoverPlugin(): BytemdPlugin {
  let markdownBody: HTMLElement | null = null;
  let previewScroller: HTMLElement | null = null;
  let activeElement: HTMLElement | null = null;
  let hoveredSourceLine: number | null = null;
  let animationFrame: number | null = null;

  const clearHighlight = () => {
    activeElement?.classList.remove(ACTIVE_CLASS_NAME);
    activeElement = null;
  };

  const scrollBlockIntoView = (element: HTMLElement) => {
    if (!previewScroller) {
      return;
    }

    const blockRect = element.getBoundingClientRect();
    const viewportRect = previewScroller.getBoundingClientRect();

    if (!isBlockOutsideViewport(blockRect, viewportRect)) {
      return;
    }

    const offset =
      blockRect.top < viewportRect.top
        ? blockRect.top - viewportRect.top - 12
        : blockRect.bottom - viewportRect.bottom + 12;

    previewScroller.scrollTo({
      top: previewScroller.scrollTop + offset,
      behavior: 'smooth',
    });
  };

  const highlightSourceLine = (sourceLine: number | null) => {
    if (!markdownBody || sourceLine === null) {
      clearHighlight();
      return;
    }

    const block = findBestSourceBlock(collectPreviewBlocks(markdownBody), sourceLine);
    const nextElement = block?.element || null;

    if (nextElement === activeElement) {
      return;
    }

    clearHighlight();

    if (!nextElement) {
      return;
    }

    nextElement.classList.add(ACTIVE_CLASS_NAME);
    activeElement = nextElement;
    scrollBlockIntoView(nextElement);
  };

  const scheduleHighlight = (sourceLine: number | null) => {
    hoveredSourceLine = sourceLine;

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
    }

    animationFrame = requestAnimationFrame(() => {
      animationFrame = null;
      highlightSourceLine(hoveredSourceLine);
    });
  };

  return {
    rehype: (processor) => processor.use(annotateSourceBlocks),
    editorEffect: ({ editor }) => {
      const editorElement = editor.getWrapperElement();

      const handleMouseMove = (event: MouseEvent) => {
        const target = event.target;

        if (!(target instanceof Element) || !target.closest('.CodeMirror-code')) {
          scheduleHighlight(null);
          return;
        }

        const position = editor.coordsChar(
          {
            left: event.clientX,
            top: event.clientY,
          },
          'window',
        );
        scheduleHighlight(position.line + 1);
      };

      const handleMouseLeave = () => {
        scheduleHighlight(null);
      };

      editorElement.addEventListener('mousemove', handleMouseMove);
      editorElement.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        editorElement.removeEventListener('mousemove', handleMouseMove);
        editorElement.removeEventListener('mouseleave', handleMouseLeave);

        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }

        hoveredSourceLine = null;
        clearHighlight();
      };
    },
    viewerEffect: ({ markdownBody: nextMarkdownBody }) => {
      markdownBody = nextMarkdownBody;
      previewScroller = nextMarkdownBody.closest<HTMLElement>('.bytemd-preview');

      const observer = new MutationObserver((records) => {
        records.forEach((record) => {
          const removedSource = Array.from(record.removedNodes).find(
            (node): node is Element =>
              node instanceof Element && node.matches(SOURCE_BLOCK_SELECTOR),
          );

          if (!removedSource) {
            return;
          }

          Array.from(record.addedNodes).forEach((node) => {
            if (node instanceof Element && !node.matches(SOURCE_BLOCK_SELECTOR)) {
              copySourceRange(removedSource, node);
            }
          });
        });

        highlightSourceLine(hoveredSourceLine);
      });

      observer.observe(nextMarkdownBody, {
        childList: true,
        subtree: true,
      });
      highlightSourceLine(hoveredSourceLine);

      return () => {
        observer.disconnect();
        clearHighlight();

        if (markdownBody === nextMarkdownBody) {
          markdownBody = null;
          previewScroller = null;
        }
      };
    },
  };
}
