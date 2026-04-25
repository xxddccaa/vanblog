import remarkDirective from 'remark-directive';
import { $nodeSchema, $remark } from '@milkdown/kit/utils';

import { CUSTOM_CONTAINER_TITLES } from '../utils';

const SUPPORTED_CUSTOM_CONTAINERS = new Set(Object.keys(CUSTOM_CONTAINER_TITLES));

export const customContainerRemark = $remark(
  'vbCustomContainerRemark',
  () => remarkDirective as never,
);

export const customContainerSchema = $nodeSchema('vb_custom_container', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  isolating: true,
  attrs: {
    name: {
      default: 'info',
      validate: 'string',
    },
    title: {
      default: '',
      validate: 'string',
    },
  },
  parseDOM: [
    {
      tag: 'div[data-vb-container]',
      contentElement: '.vb-milkdown-container__content',
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) {
          return {};
        }

        return {
          name: dom.dataset.vbContainer || 'info',
          title: dom.dataset.vbContainerTitle || '',
        };
      },
    },
  ],
  toDOM: (node) => {
    const title =
      node.attrs.title || CUSTOM_CONTAINER_TITLES[node.attrs.name as keyof typeof CUSTOM_CONTAINER_TITLES];

    return [
      'div',
      {
        'data-vb-container': node.attrs.name,
        'data-vb-container-title': title,
        class: `vb-milkdown-container ${node.attrs.name}`,
      },
      [
        'div',
        {
          class: 'vb-milkdown-container__label',
          contenteditable: 'false',
        },
        title,
      ],
      ['div', { class: 'vb-milkdown-container__content' }, 0],
    ];
  },
  parseMarkdown: {
    match: (node) =>
      node.type === 'containerDirective' &&
      typeof node.name === 'string' &&
      SUPPORTED_CUSTOM_CONTAINERS.has(node.name),
    runner: (state, node, type) => {
      const name = String(node.name || 'info');
      const attributes = (node.attributes ?? {}) as { title?: string };
      const title =
        String(attributes.title || '') ||
        CUSTOM_CONTAINER_TITLES[name as keyof typeof CUSTOM_CONTAINER_TITLES];

      state.openNode(type, { name, title });
      state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'vb_custom_container',
    runner: (state, node) => {
      state.openNode('containerDirective', undefined, {
        name: node.attrs.name,
        attributes: {
          title:
            node.attrs.title ||
            CUSTOM_CONTAINER_TITLES[node.attrs.name as keyof typeof CUSTOM_CONTAINER_TITLES],
        },
      });
      state.next(node.content);
      state.closeNode();
    },
  },
}));
