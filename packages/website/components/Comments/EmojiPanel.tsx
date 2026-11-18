import React, { useEffect, useRef, useState } from 'react';
import { COMMENT_EMOJIS, EMOJI_COLUMNS } from './emoji';

export default function EmojiPanel(props: {
  id: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    buttons.current[0]?.focus();
  }, []);

  const move = (next: number) => {
    const count = COMMENT_EMOJIS.length;
    const index = (next + count) % count;
    setActive(index);
    buttons.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        move(active + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        move(active - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        move(Math.min(active + EMOJI_COLUMNS, COMMENT_EMOJIS.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(Math.max(active - EMOJI_COLUMNS, 0));
        break;
      case 'Home':
        event.preventDefault();
        move(0);
        break;
      case 'End':
        event.preventDefault();
        move(COMMENT_EMOJIS.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        props.onClose();
        break;
      default:
        break;
    }
  };

  return (
    <div
      id={props.id}
      role="group"
      aria-label="表情"
      onKeyDown={onKeyDown}
      className="mt-2 grid grid-cols-8 gap-1 rounded-md border border-gray-200 p-2 dark:border-dark-2 vb-surface-card-subtle"
    >
      {COMMENT_EMOJIS.map(([emoji, label], index) => (
        <button
          key={emoji}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          tabIndex={index === active ? 0 : -1}
          aria-label={`插入表情：${label}`}
          title={label}
          onFocus={() => setActive(index)}
          onClick={() => props.onSelect(emoji)}
          className="flex h-9 items-center justify-center rounded text-xl leading-none transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:hover:bg-dark-hover"
        >
          <span aria-hidden="true">{emoji}</span>
        </button>
      ))}
    </div>
  );
}
