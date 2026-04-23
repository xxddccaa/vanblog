import type { Ctx } from '@milkdown/kit/ctx';
import type { Node as ProsemirrorNode } from '@milkdown/kit/prose/model';

import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { latex } from '@milkdown/crepe/feature/latex';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { CrepeBuilder } from '@milkdown/crepe/builder';
import '@milkdown/crepe/theme/classic.css';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/kit/core';
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import {
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { callCommand, insert, replaceAll } from '@milkdown/kit/utils';
import { oneDark } from '@codemirror/theme-one-dark';
import { useModel } from '@umijs/max';
import { Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MutableRefObject } from 'react';

import DocumentViewer from '@/components/DocumentViewer';
import { uploadImg } from '../../Editor/imgUpload';
import '../../style/code-dark.css';
import '../../style/code-light.css';
import '../../style/custom-container.css';
import '../../style/github-markdown.css';
import 'katex/dist/katex.css';
import { customContainerRemark, customContainerSchema } from '../plugins/customContainer';
import { consumeMarkdownUpdate, shouldSyncExternalMarkdown } from '../sync';
import Toolbar from '../toolbar/Toolbar';
import type { CustomContainerType, MarkdownEditorProps } from '../types';
import {
  buildCodeBlockSnippet,
  buildCustomContainerSnippet,
  buildLinkSnippet,
  buildMathBlockSnippet,
  buildMoreSnippet,
  buildTaskListSnippet,
  getLastCodeLanguage,
  saveLastCodeLanguage,
} from '../utils';
import '../index.less';

type MilkdownSurfaceProps = {
  builderRef: MutableRefObject<CrepeBuilder | null>;
  initialValue: string;
  themeClass: 'dark' | 'light';
  onMarkdownUpdate: (markdown: string) => void;
  setLoading: (loading: boolean) => void;
};

function createImageNodes(files: File[], ctx: Ctx, uploadedUrls: string[]) {
  const schema = ctx.get(editorViewCtx).state.schema;
  const imageType = schema.nodes.image;

  if (!imageType) {
    return [];
  }

  return uploadedUrls.map((url, index) => {
    const file = files[index];
    return imageType.create({
      src: encodeURI(url),
      alt: file?.name || '',
      title: file?.name || '',
    }) as ProsemirrorNode;
  });
}

function MilkdownSurface(props: MilkdownSurfaceProps) {
  const { builderRef, initialValue, themeClass, onMarkdownUpdate, setLoading } = props;
  const onMarkdownUpdateRef = useRef(onMarkdownUpdate);
  const setLoadingRef = useRef(setLoading);

  useEffect(() => {
    onMarkdownUpdateRef.current = onMarkdownUpdate;
  }, [onMarkdownUpdate]);

  useEffect(() => {
    setLoadingRef.current = setLoading;
  }, [setLoading]);

  useEditor(
    (root) => {
      const builder = new CrepeBuilder({
        root,
        defaultValue: initialValue || '',
      });

      builder
        .addFeature(cursor, { virtual: false })
        .addFeature(listItem)
        .addFeature(placeholder, {
          text: '开始编写 Markdown 内容',
          mode: 'doc',
        })
        .addFeature(codeMirror, {
          ...(themeClass === 'dark' ? { theme: oneDark } : {}),
          searchPlaceholder: '搜索语言',
          noResultText: '暂无结果',
          previewLabel: '预览',
          previewToggleText: (previewOnlyMode) => (previewOnlyMode ? '编辑' : '隐藏'),
        })
        .addFeature(table)
        .addFeature(latex, {
          katexOptions: {
            strict: false,
            throwOnError: false,
          },
          inlineEditConfirm: '确认',
        });

      builder.editor
        .config((ctx) => {
          ctx.update(uploadConfig.key, (prev) => ({
            ...prev,
            enableHtmlFileUploader: true,
            uploader: async (files) => {
              const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
              if (imageFiles.length === 0) {
                return [];
              }

              setLoadingRef.current(true);
              try {
                const uploadedUrls = (
                  await Promise.all(imageFiles.map((file) => uploadImg(file)))
                ).filter(Boolean) as string[];
                return createImageNodes(imageFiles, ctx, uploadedUrls);
              } finally {
                setLoadingRef.current(false);
              }
            },
          }));
        })
        .use(customContainerRemark)
        .use(customContainerSchema);

      builder.on((listener) => {
        listener.markdownUpdated((_, markdown) => {
          onMarkdownUpdateRef.current(markdown);
        });
      });

      builderRef.current = builder;
      return builder;
    },
    [builderRef, themeClass],
  );

  useEffect(
    () => () => {
      builderRef.current = null;
    },
    [builderRef],
  );

  return <Milkdown />;
}

export default function MilkdownEngine(props: MarkdownEditorProps) {
  const { loading, setLoading, value, onChange, themeConfig, codeMaxLines } = props;
  const { initialState } = useModel('@@initialState');
  const navTheme = initialState.settings.navTheme;
  const themeClass = navTheme.toLowerCase().includes('dark') ? 'dark' : 'light';
  const builderRef = useRef<CrepeBuilder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const syncStateRef = useRef({
    currentMarkdown: value || '',
    suppressNextChange: false,
  });
  const [currentCodeLanguage, setCurrentCodeLanguage] = useState(getLastCodeLanguage());

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

  const handleMarkdownUpdate = useCallback(
    (markdown: string) => {
      const { state, shouldEmit } = consumeMarkdownUpdate(syncStateRef.current, markdown);
      syncStateRef.current = state;

      if (shouldEmit) {
        onChange(markdown);
      }
    },
    [onChange],
  );

  useEffect(() => {
    const builder = builderRef.current;
    const nextValue = value || '';

    if (!builder) {
      syncStateRef.current = {
        currentMarkdown: nextValue,
        suppressNextChange: false,
      };
      return;
    }

    if (!shouldSyncExternalMarkdown(nextValue, syncStateRef.current.currentMarkdown)) {
      return;
    }

    syncStateRef.current = {
      currentMarkdown: nextValue,
      suppressNextChange: true,
    };
    builder.editor.action(replaceAll(nextValue, false));
  }, [value]);

  const runEditorAction = useCallback((handler: (ctx: Ctx) => unknown) => {
    const builder = builderRef.current;
    if (!builder) {
      return;
    }

    builder.editor.action((ctx) => {
      handler(ctx);
      ctx.get(editorViewCtx).focus();
    });
  }, []);

  const runEditorCommand = useCallback(
    (command: (ctx: Ctx) => boolean | void) => {
      runEditorAction((ctx) => {
        command(ctx);
      });
    },
    [runEditorAction],
  );

  const rememberCodeLanguage = useCallback((language: string) => {
    saveLastCodeLanguage(language);
    setCurrentCodeLanguage(getLastCodeLanguage());
  }, []);

  const handleToolbarImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = fileList ? Array.from(fileList).filter((file) => file.type.startsWith('image/')) : [];
      if (files.length === 0) {
        return;
      }

      setLoading(true);
      try {
        const uploadedUrls = await Promise.all(files.map((file) => uploadImg(file)));
        const items = uploadedUrls
          .map((url, index) => {
            if (!url) {
              return null;
            }

            return {
              url: encodeURI(url),
              file: files[index],
            };
          })
          .filter(Boolean) as Array<{ url: string; file: File }>;

        if (items.length === 0) {
          return;
        }

        runEditorAction((ctx) => {
          items.forEach(({ url, file }) => {
            callCommand(insertImageCommand.key, {
              src: url,
              alt: file.name,
              title: file.name,
            })(ctx);
          });
        });
      } finally {
        setLoading(false);
      }
    },
    [runEditorAction, setLoading],
  );

  const toolbarHandlers = useMemo(
    () => ({
      onUndo: () => runEditorCommand(callCommand(undoCommand.key)),
      onRedo: () => runEditorCommand(callCommand(redoCommand.key)),
      onHeading: (level: number) =>
        runEditorCommand(callCommand(wrapInHeadingCommand.key, level)),
      onBold: () => runEditorCommand(callCommand(toggleStrongCommand.key)),
      onItalic: () => runEditorCommand(callCommand(toggleEmphasisCommand.key)),
      onStrike: () => runEditorCommand(callCommand(toggleStrikethroughCommand.key)),
      onInlineCode: () => runEditorCommand(callCommand(toggleInlineCodeCommand.key)),
      onLink: () =>
        runEditorAction((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { from, to, empty } = view.state.selection;
          const selectedText = empty ? '链接文本' : view.state.doc.textBetween(from, to, '\n');
          insert(buildLinkSnippet(selectedText || '链接文本'), true)(ctx);
        }),
      onQuote: () => runEditorCommand(callCommand(wrapInBlockquoteCommand.key)),
      onBulletList: () => runEditorCommand(callCommand(wrapInBulletListCommand.key)),
      onOrderedList: () => runEditorCommand(callCommand(wrapInOrderedListCommand.key)),
      onTaskList: () => runEditorAction(insert(buildTaskListSnippet())),
      onCodeBlock: () => {
        rememberCodeLanguage(currentCodeLanguage);
        runEditorAction(insert(buildCodeBlockSnippet(currentCodeLanguage)));
      },
      onRememberCodeLanguage: (language: string) => {
        rememberCodeLanguage(language);
      },
      onMath: () => runEditorAction(insert(buildMathBlockSnippet())),
      onTable: () =>
        runEditorCommand(callCommand(insertTableCommand.key, { row: 3, col: 3 })),
      onImageUpload: handleToolbarImageUpload,
      onInsertMore: () => runEditorAction(insert(buildMoreSnippet())),
      onInsertContainer: (type: CustomContainerType) =>
        runEditorAction(insert(buildContainerMap[type]())),
      onInsertEmoji: (emoji: string) => runEditorAction(insert(emoji, true)),
    }),
    [
      currentCodeLanguage,
      handleToolbarImageUpload,
      rememberCodeLanguage,
      runEditorAction,
      runEditorCommand,
    ],
  );

  return (
    <div className={`vb-milkdown-editor ${themeClass}`} data-testid="markdown-editor-root">
      <Spin spinning={loading}>
        <Toolbar
          loading={loading}
          currentCodeLanguage={currentCodeLanguage}
          onUndo={toolbarHandlers.onUndo}
          onRedo={toolbarHandlers.onRedo}
          onHeading={toolbarHandlers.onHeading}
          onBold={toolbarHandlers.onBold}
          onItalic={toolbarHandlers.onItalic}
          onStrike={toolbarHandlers.onStrike}
          onInlineCode={toolbarHandlers.onInlineCode}
          onLink={toolbarHandlers.onLink}
          onQuote={toolbarHandlers.onQuote}
          onBulletList={toolbarHandlers.onBulletList}
          onOrderedList={toolbarHandlers.onOrderedList}
          onTaskList={toolbarHandlers.onTaskList}
          onCodeBlock={toolbarHandlers.onCodeBlock}
          onRememberCodeLanguage={toolbarHandlers.onRememberCodeLanguage}
          onMath={toolbarHandlers.onMath}
          onTable={toolbarHandlers.onTable}
          onImageUpload={toolbarHandlers.onImageUpload}
          onInsertMore={toolbarHandlers.onInsertMore}
          onInsertContainer={toolbarHandlers.onInsertContainer}
          onInsertEmoji={toolbarHandlers.onInsertEmoji}
        />

        <div className="vb-milkdown-editor__layout">
          <div className="vb-milkdown-editor__pane vb-milkdown-editor__pane--editor">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="vb-milkdown-editor__file-input"
              onChange={(event) => {
                void handleImageFiles(event.target.files);
                event.target.value = '';
              }}
            />

            <MilkdownProvider>
              <MilkdownSurface
                builderRef={builderRef}
                initialValue={value}
                themeClass={themeClass}
                onMarkdownUpdate={handleMarkdownUpdate}
                setLoading={setLoading}
              />
            </MilkdownProvider>
          </div>

          <div className="vb-milkdown-editor__pane vb-milkdown-editor__pane--preview">
            <DocumentViewer value={value} codeMaxLines={codeMaxLines} themeConfig={themeConfig} />
          </div>
        </div>
      </Spin>
    </div>
  );
}

const buildContainerMap = {
  info: () => buildCustomContainerSnippet('info'),
  note: () => buildCustomContainerSnippet('note'),
  warning: () => buildCustomContainerSnippet('warning'),
  danger: () => buildCustomContainerSnippet('danger'),
  tip: () => buildCustomContainerSnippet('tip'),
};
