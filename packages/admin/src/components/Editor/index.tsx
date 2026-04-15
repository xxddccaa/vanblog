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
import { useMemo, useEffect } from 'react';
import '../../style/github-markdown.css';
import '../../style/code-light.css';
import '../../style/code-dark.css';
import '../../style/custom-container.css';
import { useAdminMarkdownTheme } from '@/utils/markdownTheme';
import type { MarkdownThemeConfig } from '@/utils/markdownTheme';
import { emoji } from './emoji';
import { imgUploadPlugin, uploadImg } from './imgUpload';
import './index.less';
import { insertMore } from './insertMore';
import { cn } from './locales';
import { useModel } from '@umijs/max';
import { customContainer } from './plugins/customContainer';
import { historyIcon } from './history';
import rawHTML from './rawHTML';
import { Heading } from './plugins/heading';
import { customCodeBlock } from './plugins/codeBlock';
import { LinkTarget } from './plugins/linkTarget';
import { smartCodeBlock } from './plugins/smartCodeBlock';

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
  themeConfig?: MarkdownThemeConfig;
  codeMaxLines?: number;
}) {
  const { loading, setLoading } = props;
  const { initialState } = useModel('@@initialState');
  const navTheme = initialState.settings.navTheme;
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';
  useAdminMarkdownTheme(props.themeConfig);

  // 编辑器预览跟随站点代码折叠设置，保持与前台和文档预览一致
  const editorCodeMaxLines = Math.max(props.codeMaxLines || 15, 5);

  // 让后台编辑器支持 html.dark 类，用于基础的暗色/亮色切换
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
      if (hadDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
  }, [navTheme]);
  
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
      customCodeBlock(editorCodeMaxLines),
      LinkTarget(),
      smartCodeBlock(),
    ];
  }, [editorCodeMaxLines, setLoading]);

  return (
    <div style={{ height: '100%' }} className={themeClass}>
      <div className="editor-wrapper">
        <Spin spinning={loading}>
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
    </div>
  );
}
