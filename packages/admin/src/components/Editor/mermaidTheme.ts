import mermaid from '@bytemd/plugin-mermaid'

// 使用固定的高对比度配色方案，确保在任何主题下都能清晰可见
export function getMermaidConfig() {
  return {
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      // 使用浅蓝色背景和深色文字的高对比度方案
      primaryColor: '#e1f5fe',           // 浅蓝色背景
      primaryTextColor: '#0d47a1',       // 深蓝色文字
      primaryBorderColor: '#1976d2',     // 蓝色边框
      lineColor: '#1976d2',              // 蓝色连线
      
      // 节点颜色
      tertiaryColor: '#f3e5f5',          // 浅紫色
      tertiaryTextColor: '#4a148c',      // 深紫色文字
      tertiaryBorderColor: '#7b1fa2',    // 紫色边框
      
      // 其他元素
      background: '#ffffff',              // 白色背景
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
      edgeLabelBackground: '#ffffff',
      
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
  return mermaid(getMermaidConfig())
} 