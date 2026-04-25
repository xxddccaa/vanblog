import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { Editor, Viewer } from '@bytemd/react';
import { useModel } from '@umijs/max';
import { Spin } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import type { Root } from 'react-dom/client';

import { getMarkdownThemeId, useAdminMarkdownTheme } from '@/utils/markdownTheme';
import { customMermaidPlugin, normalizeMermaidThemeMode } from '../../Editor/mermaidTheme';
import { emoji } from '../../Editor/emoji';
import { historyIcon } from '../../Editor/history';
import { imgUploadPlugin, uploadImg } from '../../Editor/imgUpload';
import { insertMore } from '../../Editor/insertMore';
import { cn } from '../../Editor/locales';
import { customContainer } from '../../Editor/plugins/customContainer';
import { customCodeBlock } from '../../Editor/plugins/codeBlock';
import { Heading } from '../../Editor/plugins/heading';
import { LinkTarget } from '../../Editor/plugins/linkTarget';
import { customMermaidExportPlugin } from '../../Editor/plugins/mermaidExport';
import { normalizeMathDelimiters } from '../../Editor/plugins/normalizeMathDelimiters';
import { smartCodeBlock } from '../../Editor/plugins/smartCodeBlock';
import rawHTML from '../../Editor/rawHTML';
import '../../Editor/index.less';
import '../../../style/code-dark.css';
import '../../../style/code-light.css';
import '../../../style/custom-container.css';
import '../../../style/github-markdown.css';
import 'bytemd/dist/index.css';
import 'katex/dist/katex.css';

import type { MarkdownEditorProps } from '../types';

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

export default function BytemdEngine(props: MarkdownEditorProps) {
  const { loading, setLoading, themeConfig, codeMaxLines } = props;
  const previewRootRef = useRef<Root | null>(null);
  const previewElementRef = useRef<HTMLElement | null>(null);
  const { initialState } = useModel('@@initialState');
  const navTheme = initialState.settings.navTheme;
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';
  const mermaidThemeMode = normalizeMermaidThemeMode(themeClass);
  const resolvedThemeConfig = useAdminMarkdownTheme(themeConfig);
  const lightThemeId = getMarkdownThemeId(resolvedThemeConfig.markdownLightThemeUrl);
  const darkThemeId = getMarkdownThemeId(resolvedThemeConfig.markdownDarkThemeUrl);
  const editorCodeMaxLines = Math.max(codeMaxLines || 15, 5);

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
      if (hadDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };
  }, [navTheme]);

  const plugins = useMemo(
    () => [
      customContainer(),
      gfm({ locale: cn }),
      highlight(),
      math({
        locale: cn,
        katexOptions: {
          strict: false,
          throwOnError: false,
        },
      }),
      customMermaidPlugin(mermaidThemeMode),
      customMermaidExportPlugin(mermaidThemeMode),
      imgUploadPlugin(setLoading),
      emoji(),
      insertMore(),
      rawHTML(),
      historyIcon(),
      Heading(),
      customCodeBlock(editorCodeMaxLines),
      LinkTarget(),
      smartCodeBlock(),
    ],
    [editorCodeMaxLines, mermaidThemeMode, setLoading],
  );

  const overridePreview = useMemo(
    () =>
      (previewElement: HTMLElement, previewProps: any) => {
        if (!previewRootRef.current || previewElementRef.current !== previewElement) {
          previewRootRef.current?.unmount();
          previewRootRef.current = createRoot(previewElement);
          previewElementRef.current = previewElement;
        }

        previewRootRef.current.render(
          <Viewer
            value={normalizeMathDelimiters(previewProps.value)}
            plugins={plugins}
            sanitize={sanitize}
            remarkRehype={previewProps.remarkRehype}
          />,
        );
      },
    [plugins],
  );

  useEffect(
    () => () => {
      previewRootRef.current?.unmount();
      previewRootRef.current = null;
      previewElementRef.current = null;
    },
    [],
  );

  return (
    <div style={{ height: '100%' }} className={themeClass}>
      <div
        className="editor-wrapper"
        data-vb-markdown-light-theme-id={lightThemeId || undefined}
        data-vb-markdown-dark-theme-id={darkThemeId || undefined}
      >
        <Spin spinning={loading}>
          <Editor
            value={props.value}
            plugins={plugins}
            onChange={props.onChange}
            locale={cn}
            sanitize={sanitize}
            overridePreview={overridePreview}
            uploadImages={async (files: File[]) => {
              if (files.length === 1) {
                setLoading(true);
                const url = await uploadImg(files[0]);
                setLoading(false);
                return url ? [{ url: encodeURI(url) }] : [];
              }

              setLoading(true);
              const items = [];

              try {
                const uploadPromises = files.map(async (file) => {
                  const url = await uploadImg(file);
                  return url ? { url: encodeURI(url) } : null;
                });

                const results = await Promise.all(uploadPromises);
                items.push(...results.filter(Boolean));
              } catch (error) {
                console.error('批量上传图片失败:', error);
              } finally {
                setLoading(false);
              }

              return items;
            }}
          />
        </Spin>
      </div>
    </div>
  );
}
