import React from "react";
import { BytemdPlugin } from "bytemd";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

const CUSTOM_CONTAINER_TITLE: Record<string, string> = {
  note: "注",
  info: "相关信息",
  warning: "注意",
  danger: "警告",
  tip: "提示",
};

// FIXME: Addd Types
const customContainerPlugin = () => (tree, file) => {
  const source = String(file?.value ?? "");
  visit(tree, (node) => {
    if (
      node.type === "textDirective" ||
      node.type === "leafDirective" ||
      node.type === "containerDirective"
    ) {
      // 我们只支持块级容器指令（:::info 等）。remark-directive 同时启用了
      // 行内文本指令（`:` 紧跟字母，如正文里的 `:GPT`）与叶子指令，这些
      // 会被默认处理器渲染成空 <div>，导致原文丢字并意外换行。
      // 对这两类，用源码偏移把原始字面文本还原回去，当作普通文本渲染。
      if (node.type === "textDirective" || node.type === "leafDirective") {
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        if (typeof start === "number" && typeof end === "number") {
          const raw = source.slice(start, end);
          node.type = "text";
          node.value = raw;
          delete node.children;
          delete node.name;
          delete node.attributes;
          delete node.data;
        }
        return;
      }
      if (node.type == "containerDirective") {
        const { attributes, name: tagName } = node;
        const data = node.data ??= {};
        const title = attributes?.title || CUSTOM_CONTAINER_TITLE[tagName];
        const cls = `custom-container ${tagName}`;

        data.hName = "div";
        data.hProperties = {
          class: cls,
          ["type"]: title,
        };
        const toAppendP = {
          type: "paragraph",
          data: {
            hProperties: {
              class: `custom-container-title ${tagName}`
            }
          },
          children: [
            {
              type: "text",
              value: title,
            }
          ]
        }
        node.children = [
          toAppendP,
          ...node.children
        ]
      }
    }
  });
};

export function customContainer(): BytemdPlugin {
  return {
    remark: (processor) =>
      processor.use(remarkDirective).use(customContainerPlugin),
  };
}
