import { Input } from 'antd';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const optionalHexRule = {
  validator(_: any, value: string) {
    if (!value || value.trim() === '') {
      return Promise.resolve();
    }
    if (HEX_COLOR_RE.test(value.trim())) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('请输入 #RRGGBB 格式的颜色值'));
  },
};

export default function ColorValueInput(props: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  defaultValue: string;
}) {
  const previewValue = HEX_COLOR_RE.test(props.value || '')
    ? (props.value || '').toLowerCase()
    : props.defaultValue;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <Input
        type="color"
        value={previewValue}
        onChange={(event) => props.onChange?.(event.target.value.toLowerCase())}
        style={{ width: 72, padding: 4 }}
      />
      <Input
        value={props.value || ''}
        onChange={(event) => props.onChange?.(event.target.value)}
        placeholder={props.placeholder}
        suffix={
          <a
            onClick={(event) => {
              event.preventDefault();
              props.onChange?.('');
            }}
          >
            默认
          </a>
        }
      />
    </div>
  );
}
