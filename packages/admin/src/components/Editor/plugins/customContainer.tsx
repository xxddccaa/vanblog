import { BytemdPlugin } from 'bytemd';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
const CUSTOM_CONTAINER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 1024 1024"><path d="M157.4 966.004a99.435 99.435 0 0 1-99.334-99.287V668.09a99.468 99.468 0 0 1 99.333-99.287h709.323a99.425 99.425 0 0 1 99.282 99.287v198.626a99.393 99.393 0 0 1-99.282 99.287zm-14.2-297.913v198.626a14.234 14.234 0 0 0 14.2 14.199h709.322a14.233 14.233 0 0 0 14.199-14.2V668.092a14.266 14.266 0 0 0-14.2-14.199H157.4a14.266 14.266 0 0 0-14.198 14.2zm14.2-212.824a99.436 99.436 0 0 1-99.334-99.288V157.353a99.468 99.468 0 0 1 99.333-99.287h709.323a99.424 99.424 0 0 1 99.282 99.287V355.98a99.393 99.393 0 0 1-99.282 99.287zM143.2 157.353V355.98a14.233 14.233 0 0 0 14.2 14.199h709.32a14.233 14.233 0 0 0 14.2-14.2V157.354a14.266 14.266 0 0 0-14.2-14.199H157.4a14.267 14.267 0 0 0-14.198 14.2z"/></svg>';

const CUSTOM_CONTAINER_ACTIONS = [
  {
    title: 'info',
    code: `:::info{title="相关信息"}\n相关信息\n:::`,
  },
  {
    title: 'note',
    code: `:::note{title="注"}\n注\n:::`,
  },
  {
    title: 'warning',
    code: `:::warning{title="注意"}\n注意\n:::`,
  },
  {
    title: 'danger',
    code: `:::danger{title="警告"}\n警告\n:::`,
  },
  {
    title: 'tip',
    code: `:::tip{title="提示"}\n提示\n:::`,
  },
];
const CUSTOM_CONTAINER_TITLE: Record<string, string> = {
  note: '注',
  info: '相关信息',
  warning: '注意',
  danger: '警告',
  tip: '提示',
};

// FIXME: Addd Types
const customContainerPlugin = () => (tree, file) => {
  const source = String(file?.value ?? '');
  visit(tree, (node) => {
    if (
      node.type === 'textDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'containerDirective'
    ) {
      // 我们只支持块级容器指令（:::info 等）。remark-directive 同时启用了
      // 行内文本指令（`:` 紧跟字母，如正文里的 `:GPT`）与叶子指令，这些
      // 会被默认处理器渲染成空 <div>，导致原文丢字并意外换行。
      // 对这两类，用源码偏移把原始字面文本还原回去，当作普通文本渲染。
      if (node.type === 'textDirective' || node.type === 'leafDirective') {
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        if (typeof start === 'number' && typeof end === 'number') {
          const raw = source.slice(start, end);
          node.type = 'text';
          node.value = raw;
          delete node.children;
          delete node.name;
          delete node.attributes;
          delete node.data;
        }
        return;
      }
      if (node.type == 'containerDirective') {
        const { attributes, name: tagName } = node;
        const data = (node.data ??= {});
        const title = attributes?.title || CUSTOM_CONTAINER_TITLE[tagName];
        const cls = `custom-container ${tagName}`;

        data.hName = 'div';
        data.hProperties = {
          class: cls,
          ['type']: title,
        };
        const toAppendP = {
          type: 'paragraph',
          data: {
            hProperties: {
              class: `custom-container-title ${tagName}`,
            },
          },
          children: [
            {
              type: 'text',
              value: title,
            },
          ],
        };
        node.children = [toAppendP, ...node.children];
      }
    }
  });
};

export function customContainer(): BytemdPlugin {
  return {
    remark: (processor) => processor.use(remarkDirective).use(customContainerPlugin),
    actions: [
      {
        title: '自定义高亮块',
        icon: CUSTOM_CONTAINER_ICON,
        cheatsheet: `:::info{title="标题"}`,
        handler: {
          type: 'dropdown',
          actions: CUSTOM_CONTAINER_ACTIONS.map(({ title, code }) => ({
            title,
            handler: {
              type: 'action',
              click: ({ editor, appendBlock, codemirror }) => {
                const { line } = appendBlock(code);

                editor.setSelection(codemirror.Pos(line + 1, 0), codemirror.Pos(line + 1));
                editor.focus();
              },
            },
          })),
        },
      },
    ],
  };
}
