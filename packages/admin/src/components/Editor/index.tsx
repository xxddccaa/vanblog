// import breaks from '@bytemd/plugin-breaks';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
// import mermaid from '@bytemd/plugin-mermaid';
import { customMermaidPlugin } from './mermaidTheme';
import { Editor } from '@bytemd/react';
import { Spin } from 'antd';
import 'bytemd/dist/index.css';
import 'katex/dist/katex.css';
import { useMemo, useEffect, useState } from 'react';
import '../../style/github-markdown.css';
import '../../style/code-light.css';
import '../../style/code-dark.css';
import '../../style/custom-container.css';
import { emoji } from './emoji';
import { imgUploadPlugin, uploadImg } from './imgUpload';
import './index.less';
import { insertMore } from './insertMore';
import { cn } from './locales';
import { useModel } from 'umi';
import { customContainer } from './plugins/customContainer';
import { historyIcon } from './history';
import rawHTML from './rawHTML';
import { Heading } from './plugins/heading';
import { customCodeBlock } from './plugins/codeBlock';
import { LinkTarget } from './plugins/linkTarget';
import { smartCodeBlock } from './plugins/smartCodeBlock';
import { getSiteInfo } from '@/services/van-blog/api';

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

export default function EditorComponent(props: {
  value: string;
  onChange: (string: string) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
}) {
  const { loading, setLoading } = props;
  const { initialState } = useModel('@@initialState');
  const navTheme = initialState.settings.navTheme;
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';

  // 编辑器预览：默认不折叠代码块（避免编辑时还要点“展开代码”）
  const EDITOR_CODE_MAX_LINES = 1000000;

  // 让后台编辑器也支持前台同款的 html.dark / html:not(.dark) 主题选择器
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const shouldDark = navTheme.toLowerCase().includes('dark');

    if (shouldDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    return () => {
      // 卸载时恢复初始状态，避免影响其它后台页面
      if (hadDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
  }, [navTheme]);

  // 在后台编辑器中注入站点配置的 Markdown 主题 CSS（亮/暗两套）
  useEffect(() => {
    let cancelled = false;
    const LINK_ID_LIGHT = 'vanblog-admin-markdown-theme-light';
    const LINK_ID_DARK = 'vanblog-admin-markdown-theme-dark';
    const OVERRIDE_STYLE_ID = 'vanblog-admin-bg-override';

    // 添加背景色覆盖样式（确保在主题CSS之后生效）
    const ensureBgOverride = () => {
      let overrideStyle = document.getElementById(OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
      if (!overrideStyle) {
        overrideStyle = document.createElement('style');
        overrideStyle.id = OVERRIDE_STYLE_ID;
        overrideStyle.textContent = `
          /* 强制覆盖：确保后台暗色模式背景色与前台一致 */
          html.dark .bytemd-preview,
          html.dark .bytemd-preview .markdown-body,
          html.dark .markdown-body,
          .dark .bytemd-preview,
          .dark .bytemd-preview .markdown-body,
          .dark .markdown-body {
            background: #1f2226 !important;
            background-color: #1f2226 !important;
          }
          html.dark .bytemd,
          html.dark .bytemd-body,
          .dark .bytemd,
          .dark .bytemd-body {
            background: #1f2226 !important;
            background-color: #1f2226 !important;
          }
        `;
      }
      // 确保覆盖样式在最后
      document.head.appendChild(overrideStyle);
    };

    const upsertLink = (id: string, href?: string) => {
      const head = document.head;
      const existed = document.getElementById(id) as HTMLLinkElement | null;
      if (!href) {
        existed?.remove();
        return;
      }
      if (existed) {
        if (existed.href !== new URL(href, window.location.href).href) {
          existed.href = href;
        }
        // 主题CSS已存在，确保覆盖样式在最后
        ensureBgOverride();
        return;
      }
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      // 监听加载完成，然后添加覆盖样式
      link.onload = () => {
        ensureBgOverride();
      };
      head.appendChild(link);
    };

    const run = async () => {
      try {
        const { data } = await getSiteInfo();
        if (cancelled) return;
        const lightUrl =
          data?.markdownLightThemeUrl ||
          data?.markdownLightThemePreset ||
          '/markdown-themes/phycat-cherry-light-only.css';
        const darkUrl =
          data?.markdownDarkThemeUrl ||
          data?.markdownDarkThemePreset ||
          '/markdown-themes/phycat-dark-only.css';
        upsertLink(LINK_ID_LIGHT, lightUrl);
        upsertLink(LINK_ID_DARK, darkUrl);
      } catch (e) {
        // 不阻塞编辑器：拿不到配置就按默认主题
        upsertLink(LINK_ID_LIGHT, '/markdown-themes/phycat-cherry-light-only.css');
        upsertLink(LINK_ID_DARK, '/markdown-themes/phycat-dark-only.css');
      }
    };

    run();
    return () => {
      cancelled = true;
      // 不移除link：保留主题对编辑器体验更稳定；如果你希望离开编辑页就移除，可以在这里 remove。
    };
  }, []);
  
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
      imgUploadPlugin(setLoading),
      emoji(),
      insertMore(),
      rawHTML(),
      historyIcon(),
      Heading(),
      customCodeBlock(EDITOR_CODE_MAX_LINES),
      LinkTarget(),
      smartCodeBlock(),
    ];
  }, [setLoading]);

  return (
    <div style={{ height: '100%' }} className={themeClass}>
      <Spin spinning={loading} className="editor-wrapper">
        <Editor
          value={props.value}
          plugins={plugins}
          onChange={props.onChange}
          locale={cn}
          sanitize={sanitize}
          uploadImages={async (files: File[]) => {
            if (files.length === 1) {
              setLoading(true);
              const url = await uploadImg(files[0]);
              setLoading(false);
              return url ? [{ url: encodeURI(url) }] : [];
            }
            
            setLoading(true);
            const res = [];
            
            try {
              const uploadPromises = files.map(async (file) => {
                const url = await uploadImg(file);
                return url ? { url: encodeURI(url) } : null;
              });
              
              const results = await Promise.all(uploadPromises);
              res.push(...results.filter(Boolean));
            } catch (error) {
              console.error('批量上传图片失败:', error);
            } finally {
              setLoading(false);
            }
            
            return res;
          }}
        />
      </Spin>
    </div>
  );
}
