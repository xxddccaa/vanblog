import { useEffect, useState } from 'react';

import type { EditorEngine, MarkdownEditorProps } from './types';

import BytemdEngine from './engines/bytemd';
import MilkdownEngine from './engines/milkdown';
import { DEFAULT_EDITOR_ENGINE, getEditorEngine } from './utils';

export default function MarkdownEditor(props: MarkdownEditorProps) {
  const [engine, setEngine] = useState<EditorEngine>(DEFAULT_EDITOR_ENGINE);

  useEffect(() => {
    setEngine(getEditorEngine());
  }, []);

  if (engine === 'bytemd') {
    return <BytemdEngine {...props} />;
  }

  return <MilkdownEngine {...props} />;
}

export type { MarkdownEditorProps } from './types';
