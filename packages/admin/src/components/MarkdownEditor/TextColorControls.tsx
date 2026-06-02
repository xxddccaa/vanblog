import { Button } from 'antd';

import ColorValueInput from '@/components/ColorValueInput';

import {
  DEFAULT_TEXT_COLOR,
  TEXT_COLOR_PRESETS,
  normalizeTextColor,
} from './utils';

type TextColorControlsProps = {
  value: string;
  onChange: (value: string) => void;
  onApply: (color: string) => void;
  onClose: () => void;
  compact?: boolean;
};

export default function TextColorControls(props: TextColorControlsProps) {
  const { value, onChange, onApply, onClose, compact = false } = props;
  const selectedColor = normalizeTextColor(value);

  return (
    <div className={`vb-text-color-panel${compact ? ' vb-text-color-panel--compact' : ''}`}>
      <div className="vb-text-color-panel__title">点击选色</div>

      <div className="vb-text-color-panel__presets" role="group" aria-label="文字颜色预设">
        {TEXT_COLOR_PRESETS.map((preset) => {
          const active = preset === selectedColor;

          return (
            <button
              key={preset}
              type="button"
              className={`vb-text-color-panel__preset${active ? ' is-active' : ''}`}
              aria-label={`选择颜色 ${preset}`}
              title={preset}
              data-active={active ? 'true' : 'false'}
              style={{ backgroundColor: preset }}
              onClick={() => onApply(preset)}
            />
          );
        })}
      </div>

      <div className="vb-text-color-panel__custom">
        <div className="vb-text-color-panel__picker">
          <ColorValueInput
            value={value}
            onChange={onChange}
            placeholder="#ff4d4f"
            defaultValue={DEFAULT_TEXT_COLOR}
          />
        </div>
        <Button
          type="primary"
          size="small"
          onClick={() => onApply(selectedColor)}
        >
          应用
        </Button>
      </div>
    </div>
  );
}
