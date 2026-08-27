import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import { Editor } from '@bytemd/react';
import { useModel } from '@umijs/max';
import { Spin } from 'antd';
import { useEffect, useMemo } from 'react';

import { getMarkdownThemeId, useAdminMarkdownTheme } from '@/utils/markdownTheme';
import { customMermaidPlugin, normalizeMermaidThemeMode } from '../../Editor/mermaidTheme';
import { emoji } from '../../Editor/emoji';
import { historyIcon } from '../../Editor/history';
import { imgUploadPlugin, uploadImg } from '../../Editor/imgUpload';
import { insertMore } from '../../Editor/insertMore';
import { textColor } from '../../Editor/textColor';
import { cn } from '../../Editor/locales';
import { customContainer } from '../../Editor/plugins/customContainer';
import { bracketMathPlugin } from '../../Editor/plugins/bracketMath';
import { customCodeBlock } from '../../Editor/plugins/codeBlock';
import { Heading } from '../../Editor/plugins/heading';
import { LinkTarget } from '../../Editor/plugins/linkTarget';
import { customMermaidExportPlugin } from '../../Editor/plugins/mermaidExport';
import { diagramPlugin } from '../../Editor/plugins/diagrams';
import { extendedSyntaxPlugin } from '../../Editor/plugins/extendedSyntax';
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
import { sourceHoverPlugin } from '../plugins/sourceHover';
import { configureMarkdownSanitizeSchema } from '../../Editor/sanitize';

export default function BytemdEngine(props: MarkdownEditorProps) {
  const { loading, setLoading, themeConfig, codeMaxLines, sourceHover = true } = props;
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

  const plugins = useMemo(() => {
    const list = [
      // 必须排在 customContainer / extendedSyntax 这些会改写 text 节点的插件之前，
      // 否则公式原文的 offset 会被切断
      bracketMathPlugin(),
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
      diagramPlugin(mermaidThemeMode),
      extendedSyntaxPlugin(),
      imgUploadPlugin(setLoading),
      textColor(),
      emoji(),
      insertMore(),
      rawHTML(),
      historyIcon(),
      Heading(),
      customCodeBlock(editorCodeMaxLines),
      LinkTarget(),
      smartCodeBlock(),
    ];

    if (sourceHover) {
      list.push(sourceHoverPlugin());
    }

    return list;
  }, [editorCodeMaxLines, mermaidThemeMode, setLoading, sourceHover]);

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
            mode="split"
            locale={cn}
            sanitize={configureMarkdownSanitizeSchema}
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
