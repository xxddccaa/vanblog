import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EmojiModuleState = {
  loads: number;
  resolve?: () => void;
};

const getEmojiModuleState = () =>
  (globalThis as typeof globalThis & { __emojiModuleState: EmojiModuleState }).__emojiModuleState;

vi.mock('antd', async () => {
  const React = await import('react');
  return {
    Button: ({ children, icon, ...props }: any) =>
      React.createElement('button', props, icon, children),
    Dropdown: ({ children }: any) => children,
    Space: ({ children }: any) => React.createElement('div', null, children),
    Popover: ({ children, content, open, onOpenChange }: any) => {
      const child = React.Children.only(children) as React.ReactElement<any>;
      return React.createElement(
        'div',
        null,
        React.cloneElement(child, {
          onClick: (event: MouseEvent) => {
            child.props.onClick?.(event);
            onOpenChange?.(!open);
          },
        }),
        open ? React.createElement('div', { 'data-testid': 'popover-content' }, content) : null,
      );
    },
  };
});

vi.mock('@ant-design/icons', () => {
  const Icon = () => null;
  return {
    BoldOutlined: Icon,
    BgColorsOutlined: Icon,
    CodeOutlined: Icon,
    FontSizeOutlined: Icon,
    ItalicOutlined: Icon,
    LinkOutlined: Icon,
    OrderedListOutlined: Icon,
    PictureOutlined: Icon,
    RedoOutlined: Icon,
    StrikethroughOutlined: Icon,
    TableOutlined: Icon,
    UndoOutlined: Icon,
  };
});

vi.mock('../TextColorControls', () => ({
  default: () => null,
}));

vi.mock('./EmojiPicker', () => {
  const state = getEmojiModuleState();
  state.loads += 1;
  return new Promise((resolve) => {
    state.resolve = () =>
      resolve({
        default: ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => (
          <button type="button" onClick={() => onEmojiSelect('😊')}>
            choose emoji
          </button>
        ),
      });
  });
});

const createProps = () => ({
  loading: false,
  currentCodeLanguage: 'ts',
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onHeading: vi.fn(),
  onBold: vi.fn(),
  onItalic: vi.fn(),
  onStrike: vi.fn(),
  onTextColor: vi.fn(),
  onInlineCode: vi.fn(),
  onLink: vi.fn(),
  onQuote: vi.fn(),
  onBulletList: vi.fn(),
  onOrderedList: vi.fn(),
  onTaskList: vi.fn(),
  onCodeBlock: vi.fn(),
  onRememberCodeLanguage: vi.fn(),
  onMath: vi.fn(),
  onTable: vi.fn(),
  onImageUpload: vi.fn(),
  onInsertMore: vi.fn(),
  onInsertContainer: vi.fn(),
  onInsertEmoji: vi.fn(),
});

describe('MarkdownEditor emoji picker loading', () => {
  beforeEach(() => {
    vi.resetModules();
    (
      globalThis as typeof globalThis & { __emojiModuleState: EmojiModuleState }
    ).__emojiModuleState = { loads: 0 };
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the picker only after opening and forwards the selected emoji', async () => {
    const { default: Toolbar } = await import('./Toolbar');
    const props = createProps();
    render(<Toolbar {...props} />);

    expect(getEmojiModuleState().loads).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }));

    await waitFor(() => expect(getEmojiModuleState().loads).toBe(1));
    expect(screen.getByRole('status').textContent).toContain('加载中');

    await act(async () => {
      getEmojiModuleState().resolve?.();
    });

    fireEvent.click(await screen.findByRole('button', { name: 'choose emoji' }));
    expect(props.onInsertEmoji).toHaveBeenCalledWith('😊');
  });

  it('shows a local error state when the picker chunk fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { EmojiPickerErrorBoundary } = await import('./Toolbar');
    const FailedPicker = () => {
      throw new Error('chunk failed');
    };

    render(
      <EmojiPickerErrorBoundary>
        <FailedPicker />
      </EmojiPickerErrorBoundary>,
    );
    expect(await screen.findByRole('alert')).not.toBeNull();
  });
});
