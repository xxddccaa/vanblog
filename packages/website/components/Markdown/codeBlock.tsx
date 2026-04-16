import { BytemdPlugin } from "bytemd";
import copy from "copy-to-clipboard";
import toast from "react-hot-toast";
import { visit } from "unist-util-visit";

type CodeActionIcon = "copy" | "wrap" | "toggle";

const createIconNode = (icon: CodeActionIcon) => {
  const svgProperties = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
  };

  if (icon === "copy") {
    return {
      type: "element",
      tagName: "svg",
      properties: svgProperties,
      children: [
        {
          type: "element",
          tagName: "rect",
          properties: {
            x: "5",
            y: "3",
            width: "8",
            height: "10",
            rx: "2",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "path",
          properties: {
            d: "M3.5 10.5H3A2 2 0 0 1 1 8.5v-6A2 2 0 0 1 3 0.5h5.5",
          },
          children: [],
        },
      ],
    };
  }

  if (icon === "wrap") {
    return {
      type: "element",
      tagName: "svg",
      properties: svgProperties,
      children: [
        {
          type: "element",
          tagName: "path",
          properties: {
            d: "M2 4h8a2 2 0 1 1 0 4H8",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "path",
          properties: {
            d: "M2 8h6",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "path",
          properties: {
            d: "M8 6.5L6 8l2 1.5",
          },
          children: [],
        },
        {
          type: "element",
          tagName: "path",
          properties: {
            d: "M2 12h12",
          },
          children: [],
        },
      ],
    };
  }

  return {
    type: "element",
    tagName: "svg",
    properties: svgProperties,
    children: [
      {
        type: "element",
        tagName: "path",
        properties: {
          d: "M4 6l4 4 4-4",
        },
        children: [],
      },
    ],
  };
};

const setWrapButtonState = (wrapBtn: HTMLElement, isWrapped: boolean) => {
  wrapBtn.classList.toggle("code-wrap-enabled", isWrapped);
  const label = isWrapped ? "取消自动换行" : "自动换行";
  wrapBtn.title = label;
  wrapBtn.setAttribute("aria-label", label);
};

const setToggleButtonState = (toggleBtn: HTMLElement, isCollapsed: boolean) => {
  toggleBtn.classList.toggle("code-collapsed", isCollapsed);
  const label = isCollapsed ? "展开代码" : "收起代码";
  toggleBtn.title = label;
  toggleBtn.setAttribute("aria-label", label);
};

// FIXME: Addd Types
const codeBlockPlugin = () => (tree) => {
  visit(tree, (node) => {
    if (node.type === "element" && node.tagName === "pre") {
      const oldChildren = JSON.parse(JSON.stringify(node.children));
      const codeProperties = oldChildren.find(
        (child: any) => child.tagName === "code"
      ).properties;
      let language = "";
      if (codeProperties.className) {
        for (const each of codeProperties.className) {
          if (each.startsWith("language-")) {
            language = each.replace("language-", "");
            break;
          }
        }
      }
      if (language === "mermaid") return;

      const codeCopyBtn = {
        type: "element",
        tagName: "div",
        properties: {
          class: "code-copy-btn",
          title: "复制代码",
          role: "button",
          tabIndex: "0",
          "aria-label": "复制代码",
        },
        children: [createIconNode("copy")],
      };

      const codeWrapBtn = {
        type: "element",
        tagName: "div",
        properties: {
          class: "code-wrap-btn ml-1",
          title: "自动换行",
          role: "button",
          tabIndex: "0",
          "aria-label": "自动换行",
        },
        children: [createIconNode("wrap")],
      };

      const codeToggleBtn = {
        type: "element",
        tagName: "div",
        properties: {
          class: "code-toggle-btn ml-1",
          title: "展开代码",
          role: "button",
          tabIndex: "0",
          "aria-label": "展开代码",
        },
        children: [createIconNode("toggle")],
      };

      const languageTag = {
        type: "element",
        tagName: "span",
        properties: {
          class: "language-tag mr-1",
          style: "line-height: 21px",
        },
        children: [
          {
            type: "text",
            value: language,
          },
        ],
      };

      const headerRight = {
        type: "element",
        tagName: "div",
        properties: {
          class: "header-right flex",
          style: "color: #6f7177",
        },
        children: [languageTag, codeCopyBtn, codeWrapBtn, codeToggleBtn],
      };

      const codeContentWrapper = {
        type: "element",
        tagName: "div",
        properties: {
          class: "code-content-wrapper",
        },
        children: [...oldChildren],
      };

      const wrapperDiv = {
        type: "element",
        tagName: "div",
        properties: {
          class: "code-block-wrapper relative",
        },
        children: [headerRight, codeContentWrapper],
      };
      node.children = [wrapperDiv];
    }
    if (node.type === "element" && node.tagName === "code") {
      if (!node?.properties?.className?.includes("hljs")) {
        node.properties.className = [
          "code-inline",
          ...(node?.properties?.className || []),
        ];
      }
    }
  });
};

const onClickCopyCode = (e: PointerEvent) => {
  const copyBtn = (e.target as HTMLElement | null)?.closest(".code-copy-btn") as
    | HTMLElement
    | null;
  const code = copyBtn
    ?.closest(".code-block-wrapper")
    ?.querySelector("code")
    ?.innerText;

  if (!code) return;

  copy(code);
  toast.success("复制成功", {
    className: "toast",
  });
};

const onClickToggleCode = (e: PointerEvent) => {
  const toggleBtn = (e.target as HTMLElement | null)?.closest(
    ".code-toggle-btn"
  ) as HTMLElement | null;
  const codeBlockWrapper = toggleBtn?.closest(".code-block-wrapper");
  const codeContentWrapper = codeBlockWrapper?.querySelector(
    ".code-content-wrapper"
  ) as HTMLElement | null;

  if (!toggleBtn || !codeContentWrapper) return;

  const isCollapsed = codeContentWrapper.classList.contains("code-collapsed");
  const nextCollapsed = !isCollapsed;

  codeContentWrapper.classList.toggle("code-collapsed", nextCollapsed);
  if (!nextCollapsed) {
    codeContentWrapper.style.removeProperty("max-height");
  }
  setToggleButtonState(toggleBtn, nextCollapsed);
};

const onClickToggleWrap = (e: PointerEvent) => {
  const wrapBtn = (e.target as HTMLElement | null)?.closest(
    ".code-wrap-btn"
  ) as HTMLElement | null;
  const codeBlockWrapper = wrapBtn?.closest(".code-block-wrapper");
  const codeContentWrapper = codeBlockWrapper?.querySelector(
    ".code-content-wrapper"
  ) as HTMLElement | null;

  if (!wrapBtn || !codeContentWrapper) return;

  const nextWrapped = !codeContentWrapper.classList.contains(
    "code-wrap-enabled"
  );
  codeContentWrapper.classList.toggle("code-wrap-enabled", nextWrapped);
  setWrapButtonState(wrapBtn, nextWrapped);
};

// 检查代码是否超过指定行数
const shouldCollapseCode = (
  codeElement: Element,
  maxLines: number = 15
): boolean => {
  const codeText = codeElement.textContent || "";
  const lines = codeText.trim().split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  return (
    lines.length > maxLines ||
    nonEmptyLines.length > Math.max(maxLines - 3, 5)
  );
};

export function customCodeBlock(maxLines: number = 15): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(codeBlockPlugin),
    viewerEffect: ({ markdownBody }) => {
      markdownBody.querySelectorAll(".code-block-wrapper").forEach((codeBlock) => {
        const copyBtn = codeBlock.querySelector(".code-copy-btn") as HTMLElement;
        const wrapBtn = codeBlock.querySelector(".code-wrap-btn") as HTMLElement;
        const toggleBtn = codeBlock.querySelector(
          ".code-toggle-btn"
        ) as HTMLElement;
        const codeContentWrapper = codeBlock.querySelector(
          ".code-content-wrapper"
        ) as HTMLElement;
        const codeElement = codeBlock.querySelector("code");

        copyBtn?.removeEventListener("click", onClickCopyCode);
        wrapBtn?.removeEventListener("click", onClickToggleWrap);
        toggleBtn?.removeEventListener("click", onClickToggleCode);

        copyBtn?.addEventListener("click", onClickCopyCode);
        wrapBtn?.addEventListener("click", onClickToggleWrap);

        if (wrapBtn) {
          setWrapButtonState(
            wrapBtn,
            codeContentWrapper?.classList.contains("code-wrap-enabled") ?? false
          );
        }

        if (codeElement && shouldCollapseCode(codeElement, maxLines)) {
          codeContentWrapper?.classList.add("code-collapsed");
          if (toggleBtn) {
            setToggleButtonState(toggleBtn, true);
            toggleBtn.style.display = "inline-flex";
            toggleBtn.addEventListener("click", onClickToggleCode);
          }

          if (codeContentWrapper) {
            const lineHeight = 1.4;
            const padding = 1;
            const maxHeight = maxLines * lineHeight + padding + "em";
            codeContentWrapper.style.setProperty("--code-max-height", maxHeight);
          }
        } else if (toggleBtn) {
          codeContentWrapper?.classList.remove("code-collapsed");
          setToggleButtonState(toggleBtn, false);
          toggleBtn.style.display = "none";
        }
      });
    },
  };
}
