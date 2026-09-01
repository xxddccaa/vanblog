import { Component, lazy, Suspense, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';

import type { MarkdownEditorProps } from './types';
import type { ComponentType, ReactNode } from 'react';

import { getEditorEngine } from './utils';

type EngineComponent = ComponentType<MarkdownEditorProps>;
type Loader = () => Promise<{ default: EngineComponent }>;
type EngineLoaders = {
  bytemd: Loader;
  milkdown: Loader;
};

const loadBytemd = () => import('./engines/bytemd');
const loadMilkdown = () => import('./engines/milkdown');
const defaultEngineLoaders: EngineLoaders = {
  bytemd: loadBytemd,
  milkdown: loadMilkdown,
};

class EditorEngineErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" data-testid="markdown-editor-error">
          <p>Markdown 编辑器加载失败</p>
          <Button type="primary" onClick={this.props.onRetry}>
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function MarkdownEditor({
  engineLoaders = defaultEngineLoaders,
  ...props
}: MarkdownEditorProps & { engineLoaders?: EngineLoaders }) {
  const [engine] = useState(getEditorEngine);
  const [attempt, setAttempt] = useState(0);
  const loader = engineLoaders[engine];
  const ActiveEngine = useMemo(() => lazy(loader), [attempt, loader]);

  return (
    <EditorEngineErrorBoundary
      key={`${engine}-${attempt}`}
      onRetry={() => setAttempt((current) => current + 1)}
    >
      <Suspense
        fallback={
          <div
            data-testid="markdown-editor-loading"
            style={{ minHeight: 320, display: 'grid', placeItems: 'center' }}
          >
            <Spin />
          </div>
        }
      >
        <ActiveEngine {...props} />
      </Suspense>
    </EditorEngineErrorBoundary>
  );
}

export type { MarkdownEditorProps } from './types';
export { EditorEngineErrorBoundary };
