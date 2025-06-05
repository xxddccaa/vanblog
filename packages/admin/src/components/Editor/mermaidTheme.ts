import mermaid from '@bytemd/plugin-mermaid'

// 强制设置mermaid样式，抵抗DarkReader等插件的干扰
function forceMermaidStyles() {
  const applyStyles = () => {
    // 查找所有mermaid容器
    const mermaidContainers = document.querySelectorAll('.mermaid, .bytemd-mermaid');
    
    mermaidContainers.forEach((container: HTMLElement) => {
      // 强制设置容器样式
      container.style.setProperty('background-color', '#f8f5ff', 'important');
      container.style.setProperty('border', '2px solid #9c27b0', 'important');
      container.style.setProperty('border-radius', '8px', 'important');
      container.style.setProperty('padding', '16px', 'important');
      container.style.setProperty('margin', '16px 0', 'important');
      container.style.setProperty('position', 'relative', 'important');
      container.style.setProperty('z-index', '10', 'important');
      container.style.setProperty('opacity', '1', 'important');
      container.style.setProperty('isolation', 'isolate', 'important');
      
      // 查找SVG元素
      const svgElements = container.querySelectorAll('svg');
      svgElements.forEach((svg: SVGElement) => {
        // 强制设置SVG背景
        svg.style.setProperty('background-color', '#f8f5ff', 'important');
        svg.style.setProperty('opacity', '1', 'important');
        
        // 移除DarkReader的属性并重新设置样式
        const elementsWithDarkReader = svg.querySelectorAll('[data-darkreader-inline-fill], [data-darkreader-inline-stroke]');
        elementsWithDarkReader.forEach((element: Element) => {
          // 移除DarkReader属性
          element.removeAttribute('data-darkreader-inline-fill');
          element.removeAttribute('data-darkreader-inline-stroke');
          
          // 确保文字和线条在浅紫色背景上可见(使用深色)
          const htmlElement = element as HTMLElement;
          
          // 如果是文字元素，设置为深色
          if (element.tagName === 'text' || element.classList.contains('messageText') || element.classList.contains('actor')) {
            htmlElement.style.setProperty('fill', '#0d47a1', 'important');
            htmlElement.style.setProperty('color', '#0d47a1', 'important');
          }
          
          // 如果是线条或路径，设置为深色
          if (element.tagName === 'line' || element.tagName === 'path' || element.classList.contains('messageLine0') || element.classList.contains('messageLine1')) {
            htmlElement.style.setProperty('stroke', '#0d47a1', 'important');
          }
          
          // 如果是矩形框，保持浅色背景和深色边框
          if (element.tagName === 'rect' && element.classList.contains('actor')) {
            htmlElement.style.setProperty('fill', '#e1f5fe', 'important');
            htmlElement.style.setProperty('stroke', '#1976d2', 'important');
          }
        });
        
        // 额外处理所有文字元素
        const textElements = svg.querySelectorAll('text, tspan');
        textElements.forEach((textEl: Element) => {
          const htmlTextEl = textEl as HTMLElement;
          htmlTextEl.style.setProperty('fill', '#0d47a1', 'important');
          htmlTextEl.style.setProperty('color', '#0d47a1', 'important');
        });
        
        // 额外处理所有线条元素
        const lineElements = svg.querySelectorAll('line, path[class*="messageLine"]');
        lineElements.forEach((lineEl: Element) => {
          const htmlLineEl = lineEl as HTMLElement;
          htmlLineEl.style.setProperty('stroke', '#0d47a1', 'important');
        });
        
        // 额外处理矩形元素
        const rectElements = svg.querySelectorAll('rect');
        rectElements.forEach((rectEl: Element) => {
          const htmlRectEl = rectEl as HTMLElement;
          if (rectEl.classList.contains('actor')) {
            htmlRectEl.style.setProperty('fill', '#e1f5fe', 'important');
            htmlRectEl.style.setProperty('stroke', '#1976d2', 'important');
          }
        });
      });
    });
  };

  // 立即执行一次
  applyStyles();
  
  // 使用MutationObserver监听DOM变化
  const observer = new MutationObserver((mutations) => {
    let shouldApply = false;
    
    mutations.forEach((mutation) => {
      // 检查是否有新的mermaid元素或属性变化
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.classList?.contains('mermaid') || 
                element.classList?.contains('bytemd-mermaid') ||
                element.querySelector?.('.mermaid, .bytemd-mermaid')) {
              shouldApply = true;
            }
          }
        });
      } else if (mutation.type === 'attributes') {
        const target = mutation.target as Element;
        if ((mutation.attributeName && mutation.attributeName.indexOf('data-darkreader') === 0) ||
            target.closest?.('.mermaid, .bytemd-mermaid')) {
          shouldApply = true;
        }
      }
    });
    
    if (shouldApply) {
      // 稍微延迟执行，让mermaid完成渲染
      setTimeout(applyStyles, 100);
    }
  });
  
  // 开始监听
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-darkreader-inline-fill', 'data-darkreader-inline-stroke', 'style']
  });
  
  // 定期检查并重新应用样式(作为保险措施)
  setInterval(applyStyles, 2000);
}

// 使用固定的高对比度配色方案，确保在任何主题下都能清晰可见
export function getMermaidConfig() {
  return {
    // 设置为 false 表示不会在页面加载时自动渲染 mermaid 图表，而是等待手动触发渲染
    startOnLoad: true,
    theme: 'base',
    themeVariables: {
      // 使用浅蓝色背景和深色文字的高对比度方案
      primaryColor: '#e1f5fe',           // 浅蓝色背景
      primaryTextColor: '#0d47a1',       // 深蓝色文字
      primaryBorderColor: '#1976d2',     // 蓝色边框
      lineColor: '#0d47a1',              // 深蓝色连线
      
      // 节点颜色
      tertiaryColor: '#f3e5f5',          // 浅紫色
      tertiaryTextColor: '#4a148c',      // 深紫色文字
      tertiaryBorderColor: '#7b1fa2',    // 紫色边框
      
      // 其他元素
      background: '#f8f5ff',              // 淡紫色背景，与CSS样式保持一致
      secondaryColor: '#fff3e0',         // 浅橙色
      secondaryTextColor: '#e65100',     // 深橙色文字
      secondaryBorderColor: '#ff9800',   // 橙色边框
      
      // 文字相关
      mainBkg: '#e1f5fe',
      textColor: '#0d47a1',
      labelTextColor: '#0d47a1',
      nodeTextColor: '#0d47a1',
      
      // 序列图
      actorBkg: '#e8f5e8',
      actorBorder: '#4caf50',
      actorTextColor: '#2e7d32',
      
      // 确保所有文字都是深色，背景都是浅色
      titleColor: '#0d47a1',
      edgeLabelBackground: '#f8f5ff',    // 淡紫色背景，与整体主题保持一致
      
      // 流程图
      fillType0: '#e1f5fe',
      fillType1: '#f3e5f5',
      fillType2: '#fff3e0',
      fillType3: '#e8f5e8',
    }
  }
}

// 创建自定义的mermaid插件
export const customMermaidPlugin = () => {
  // 确保在DOM加载后设置样式强制器
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(forceMermaidStyles, 1000);
      });
    } else {
      setTimeout(forceMermaidStyles, 1000);
    }
  }
  
  return mermaid(getMermaidConfig())
} 