import type { BytemdPlugin } from 'bytemd';
import { visit } from 'unist-util-visit';
import copy from 'copy-to-clipboard';
import { message } from 'antd';
// FIXME: Addd Types
const codeBlockPlugin = () => (tree) => {
  visit(tree, (node) => {
    if (node.type === 'element' && node.tagName === 'pre') {
      const oldChildren = JSON.parse(JSON.stringify(node.children));
      const codeProperties = oldChildren.find((child: any) => child.tagName === 'code').properties;
      let language = '';
      if (codeProperties.className) {
        for (const each of codeProperties.className) {
          if (each.startsWith('language-')) {
            language = each.replace('language-', '');
            break;
          }
        }
      }
      if (language === 'mermaid') return;
      
      // 复制按钮
      const codeCopyBtn = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'code-copy-btn',
        },
        children: [],
      };
      
      // 展开/收起按钮
      const codeToggleBtn = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'code-toggle-btn ml-1',
          title: '展开/收起代码',
        },
        children: [
          {
            type: 'text',
            value: '展开代码',
          },
        ],
      };
      
      const languageTag = {
        type: 'element',
        tagName: 'span',
        properties: {
          class: 'language-tag mr-1',
          style: 'line-height: 21px',
        },
        children: [
          {
            type: 'text',
            value: language,
          },
        ],
      };
      
      // 上方右侧 header
      const headerRight = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'header-right flex',
          style: 'color: #6f7177',
        },
        children: [languageTag, codeCopyBtn, codeToggleBtn],
      };
      
      // 代码内容包装器，用于控制展开/收起
      const codeContentWrapper = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'code-content-wrapper',
        },
        children: [...oldChildren],
      };
      
      // 包裹的 div
      const wrapperDiv = {
        type: 'element',
        tagName: 'div',
        properties: {
          class: 'code-block-wrapper relative',
        },
        children: [headerRight, codeContentWrapper],
      };
      node.children = [wrapperDiv];
    }
  });
};

const onClickCopyCode = (e: PointerEvent) => {
  const copyBtn = e.target as HTMLElement;
  const code = copyBtn.parentElement?.parentElement?.querySelector('code')?.innerText;
  copy(code);
  message.success('复制成功');
};

const onClickToggleCode = (e: PointerEvent) => {
  const toggleBtn = e.target as HTMLElement;
  const codeBlockWrapper = toggleBtn.closest('.code-block-wrapper');
  const codeContentWrapper = codeBlockWrapper?.querySelector('.code-content-wrapper') as HTMLElement;
  
  if (!codeContentWrapper) return;
  
  const isCollapsed = codeContentWrapper.classList.contains('code-collapsed');
  
  if (isCollapsed) {
    codeContentWrapper.classList.remove('code-collapsed');
    toggleBtn.classList.remove('code-collapsed');
    // 清除可能残留的内联 max-height，确保真正展开
    codeContentWrapper.style.removeProperty('max-height');
    toggleBtn.textContent = '收起代码';
    toggleBtn.title = '收起代码';
  } else {
    codeContentWrapper.classList.add('code-collapsed');
    toggleBtn.classList.add('code-collapsed');
    toggleBtn.textContent = '展开代码';
    toggleBtn.title = '展开代码';
  }
};

// 检查代码是否超过指定行数
const shouldCollapseCode = (codeElement: Element, maxLines: number = 15): boolean => {
  const codeText = codeElement.textContent || '';
  // 移除首尾空白字符，然后按换行符分割
  const lines = codeText.trim().split('\n');
  // 过滤掉空行，只计算有内容的行数
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  // 如果总行数超过设定行数，或者非空行数超过设定行数-3，就需要折叠
  return lines.length > maxLines || nonEmptyLines.length > Math.max(maxLines - 3, 5);
};

export function customCodeBlock(maxLines: number = 15): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(codeBlockPlugin),
    viewerEffect: ({ markdownBody }) => {
      markdownBody.querySelectorAll('.code-block-wrapper').forEach((codeBlock) => {
        const copyBtn = codeBlock.querySelector('.code-copy-btn') as HTMLElement;
        const toggleBtn = codeBlock.querySelector('.code-toggle-btn') as HTMLElement;
        const codeContentWrapper = codeBlock.querySelector('.code-content-wrapper') as HTMLElement;
        const codeElement = codeBlock.querySelector('code');
        
        // 移除之前的事件监听器
        copyBtn?.removeEventListener('click', onClickCopyCode);
        toggleBtn?.removeEventListener('click', onClickToggleCode);
        
        // 添加复制按钮事件
        copyBtn?.addEventListener('click', onClickCopyCode);
        
        // 检查是否需要折叠，使用传入的maxLines参数
        if (codeElement && shouldCollapseCode(codeElement, maxLines)) {
          // 默认折叠状态
          codeContentWrapper?.classList.add('code-collapsed');
          toggleBtn?.classList.add('code-collapsed');
          if (toggleBtn) {
            toggleBtn.textContent = '展开代码';
            toggleBtn.title = '展开代码';
          }
          // 显示切换按钮
          if (toggleBtn) {
            toggleBtn.style.display = 'block';
            toggleBtn.addEventListener('click', onClickToggleCode);
          }
          
          // 动态设置折叠高度
          if (codeContentWrapper) {
            // 计算高度：每行约1.4em，加上一些padding
            const lineHeight = 1.4;
            const padding = 1; // 额外的padding
            const maxHeight = (maxLines * lineHeight + padding) + 'em';
            codeContentWrapper.style.setProperty('--code-max-height', maxHeight);
            // 不设置内联 max-height，避免展开时被内联样式覆盖
          }
        } else {
          // 代码行数不多，隐藏切换按钮
          if (toggleBtn) {
            toggleBtn.style.display = 'none';
          }
        }
      });
    },
  };
}
