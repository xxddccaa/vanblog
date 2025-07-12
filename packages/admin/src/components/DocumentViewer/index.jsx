import { Viewer } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { customMermaidPlugin } from '../Editor/mermaidTheme';
import { cn } from '../Editor/locales';
import { customContainer } from '../Editor/plugins/customContainer';
import { customCodeBlock } from '../Editor/plugins/codeBlock';
import { LinkTarget } from '../Editor/plugins/linkTarget';
import rawHTML from '../Editor/rawHTML';
import { Heading } from '../Editor/plugins/heading';
import { smartCodeBlock } from '../Editor/plugins/smartCodeBlock';
import { useModel } from 'umi';
import { useMemo, useEffect, useRef } from 'react';
import 'bytemd/dist/index.css';
import 'katex/dist/katex.css';
import '../../style/github-markdown.css';
import '../../style/code-light.css';
import '../../style/code-dark.css';
import '../../style/custom-container.css';
import './index.less';

const sanitize = (schema) => {
  schema.protocols.src.push('data');
  schema.tagNames.push('center');
  schema.tagNames.push('iframe');
  schema.tagNames.push('script');
  schema.attributes['*'].push('style');
  schema.attributes['*'].push('src');
  schema.attributes['*'].push('scrolling');
  schema.attributes['*'].push('border');
  schema.attributes['*'].push('frameborder');
  schema.attributes['*'].push('framespacing');
  schema.attributes['*'].push('allowfullscreen');
  schema.strip = [];
  return schema;
};

export default function DocumentViewer(props) {
  const { value } = props;
  const { initialState } = useModel('@@initialState');
  const navTheme = initialState.settings.navTheme;
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';
  const viewerRef = useRef(null);
  
  const plugins = useMemo(() => {
    return [
      customContainer(),
      gfm({ locale: cn }),
      highlight(),
      math({ 
        locale: cn,
        katexOptions: {
          strict: false,
          throwOnError: false,
        }
      }),
      customMermaidPlugin(),
      customCodeBlock(),
      LinkTarget(),
      rawHTML(),
      Heading(),
      smartCodeBlock(),
    ];
  }, []);

  // 确保样式在渲染后正确应用
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewerRef.current) {
        // 强制重新应用样式类
        const viewer = viewerRef.current;
        viewer.className = `document-viewer ${themeClass}`;
        
        // 确保代码块相关样式正确应用
        const codeBlocks = viewer.querySelectorAll('.code-block-wrapper');
        codeBlocks.forEach(block => {
          const toggleBtn = block.querySelector('.code-toggle-btn');
          const contentWrapper = block.querySelector('.code-content-wrapper');
          const codeElement = block.querySelector('code');
          
          if (toggleBtn && contentWrapper && codeElement) {
            // 重新检查是否需要折叠
            const codeText = codeElement.textContent || '';
            const lines = codeText.trim().split('\n');
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            const shouldCollapse = lines.length > 15 || nonEmptyLines.length > 12;
            
            if (shouldCollapse) {
              contentWrapper.classList.add('code-collapsed');
              toggleBtn.classList.add('code-collapsed');
              toggleBtn.textContent = '展开代码';
              toggleBtn.title = '展开代码';
              toggleBtn.style.display = 'block';
            } else {
              toggleBtn.style.display = 'none';
            }
          }
        });
      }
    }, 100); // 延迟100ms确保DOM完全渲染

    return () => clearTimeout(timer);
  }, [value, themeClass]);

  return (
    <div 
      ref={viewerRef}
      className={`document-viewer ${themeClass}`}
      style={{ 
        height: '100%',
        width: '100%',
        overflow: 'auto'
      }}
    >
      <Viewer
        value={value || ''}
        plugins={plugins}
        sanitize={sanitize}
      />
    </div>
  );
} 