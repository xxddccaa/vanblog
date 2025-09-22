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
import { getLayoutConfig } from '@/services/van-blog/api';

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
  const [codeMaxLines, setCodeMaxLines] = useState(15);
  
  useEffect(() => {
    const fetchLayoutConfig = async () => {
      try {
        const { data } = await getLayoutConfig();
        setCodeMaxLines(data?.codeMaxLines || 15);
      } catch (error) {
        console.error('Failed to fetch layout config:', error);
      }
    };
    fetchLayoutConfig();
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
      customCodeBlock(codeMaxLines),
      LinkTarget(),
      smartCodeBlock(),
    ];
  }, [codeMaxLines]);

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
