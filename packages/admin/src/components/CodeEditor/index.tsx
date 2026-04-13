import MonacoEditor from 'react-monaco-editor';
import { useModel } from '@umijs/max';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  width?: number;
  height?: string | number;
  style?: React.CSSProperties;
}

export default function ({ style, width, height, language, onChange, value }: CodeEditorProps) {
  const { initialState } = useModel('@@initialState');

  return (
    <div style={style}>
      <MonacoEditor
        width={width}
        height={height}
        language={language}
        theme={initialState?.settings?.navTheme == 'light' ? 'vs-light' : 'vs-dark'}
        value={value}
        onChange={(v) => {
          onChange(v);
        }}
      />
    </div>
  );
}
