import type { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';

function remarkMarkSubSup() {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return;

      const value: string = node.value;
      // Match ==mark==, ~sub~, ^sup^ patterns
      const regex = /(?:==([^=]+)==|~([^~]+)~|\^([^^]+)\^)/g;
      let match;
      const parts: any[] = [];
      let lastIndex = 0;

      while ((match = regex.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }

        if (match[1]) {
          parts.push({
            type: 'html',
            value: `<mark>${escapeHtml(match[1])}</mark>`,
          });
        } else if (match[2]) {
          parts.push({
            type: 'html',
            value: `<sub>${escapeHtml(match[2])}</sub>`,
          });
        } else if (match[3]) {
          parts.push({
            type: 'html',
            value: `<sup>${escapeHtml(match[3])}</sup>`,
          });
        }

        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) return;

      if (lastIndex < value.length) {
        parts.push({ type: 'text', value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...parts);
    });
  };
}

function remarkAbbreviation() {
  return (tree: any) => {
    const definitions = new Map<string, string>();

    // First pass: extract abbreviation definitions
    visit(tree, 'paragraph', (node: any, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return;
      if (!node.children || node.children.length !== 1) return;
      const child = node.children[0];
      if (child.type !== 'text') return;

      const match = child.value.match(/^\*\[([^\]]+)\]:\s*(.+)$/);
      if (match) {
        definitions.set(match[1], match[2].trim());
        parent.children.splice(index, 1);
        return index as any;
      }
    });

    if (definitions.size === 0) return;

    // Second pass: replace abbreviations in text nodes
    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return;

      let value: string = node.value;
      let changed = false;
      const parts: any[] = [];
      let lastIndex = 0;

      const pattern = new RegExp(
        `\\b(${Array.from(definitions.keys()).map(escapeRegExp).join('|')})\\b`,
        'g',
      );

      let match;
      while ((match = pattern.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        const title = definitions.get(match[1]) || '';
        parts.push({
          type: 'html',
          value: `<abbr title="${escapeHtml(title)}">${escapeHtml(match[1])}</abbr>`,
        });
        lastIndex = match.index + match[0].length;
        changed = true;
      }

      if (!changed) return;
      if (lastIndex < value.length) {
        parts.push({ type: 'text', value: value.slice(lastIndex) });
      }
      parent.children.splice(index, 1, ...parts);
    });
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extendedSyntaxPlugin(): BytemdPlugin {
  return {
    remark: (processor) => processor.use(remarkMarkSubSup as any).use(remarkAbbreviation as any),
  };
}
