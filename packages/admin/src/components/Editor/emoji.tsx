//@ts-ignore
import data from '@emoji-mart/data';
//@ts-ignore
import i18n from '@emoji-mart/data/i18n/zh.json';
import Picker from '@emoji-mart/react';
import { BytemdPlugin } from 'bytemd';
import { render } from 'react-dom';

const EMOJI_ICON =
  '<svg data-vb-emoji-icon="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 1024 1024"><path d="M510.944 960c-247.04 0-448-200.96-448-448s200.992-448 448-448 448 200.96 448 448-200.96 448-448 448zm0-832c-211.744 0-384 172.256-384 384s172.256 384 384 384 384-172.256 384-384-172.256-384-384-384z"/><path d="M512 773.344c-89.184 0-171.904-40.32-226.912-110.624-10.88-13.92-8.448-34.016 5.472-44.896 13.888-10.912 34.016-8.48 44.928 5.472 42.784 54.688 107.136 86.048 176.512 86.048 70.112 0 134.88-31.904 177.664-87.552 10.784-14.016 30.848-16.672 44.864-5.888 14.016 10.784 16.672 30.88 5.888 44.864C685.408 732.32 602.144 773.344 512 773.344zM368 515.2c-26.528 0-48-21.472-48-48v-64c0-26.528 21.472-48 48-48s48 21.472 48 48v64c0 26.496-21.504 48-48 48zm288 0c-26.496 0-48-21.472-48-48v-64c0-26.528 21.504-48 48-48s48 21.472 48 48v64c0 26.496-21.504 48-48 48z"/></svg>';

export const emoji = (): BytemdPlugin => {
  let lastSelection: any = null;
  let panelElement: HTMLElement | null = null;
  let activeButton: HTMLElement | null = null;
  let removeDocumentClick: (() => void) | null = null;
  let removeNativeEmojiClick: (() => void) | null = null;
  let lastInsert: { native: string; time: number } | null = null;

  const closePanel = () => {
    panelElement?.classList.add('hidden');
    activeButton?.classList.remove('vb-emoji-button-active');
    activeButton = null;
    removeDocumentClick?.();
    removeDocumentClick = null;
  };

  const positionPanel = (root: HTMLElement) => {
    if (!panelElement) {
      return;
    }

    const toolbar = root.querySelector('.bytemd-toolbar-left') as HTMLElement | null;
    const button = root
      .querySelector('[data-vb-emoji-icon="true"]')
      ?.closest('.bytemd-toolbar-icon') as HTMLElement | null;

    if (!toolbar || !button) {
      return;
    }

    const toolbarRect = toolbar.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const panelWidth = panelElement.offsetWidth || 352;
    const left = Math.max(
      0,
      Math.min(buttonRect.left - toolbarRect.left, toolbar.clientWidth - panelWidth),
    );

    panelElement.style.left = `${left}px`;
    activeButton?.classList.remove('vb-emoji-button-active');
    activeButton = button;
    activeButton.classList.add('vb-emoji-button-active');
  };

  const bindDocumentClick = () => {
    removeDocumentClick?.();

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        (panelElement?.contains(target) || activeButton?.contains(target))
      ) {
        return;
      }

      closePanel();
    };

    document.addEventListener('click', handleDocumentClick);
    removeDocumentClick = () => document.removeEventListener('click', handleDocumentClick);
  };

  const insertEmojiNative = (native: string, editor: any) => {
    const now = Date.now();

    if (lastInsert?.native === native && now - lastInsert.time < 120) {
      return;
    }

    lastInsert = { native, time: now };

    if (lastSelection?.anchor && lastSelection?.head) {
      editor.setSelection(lastSelection.anchor, lastSelection.head);
    }

    editor.focus();
    editor.replaceSelection(native);
    lastSelection = editor.listSelections?.()?.[0] || null;
    closePanel();
  };

  const getNativeEmojiFromEvent = (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;

    return (
      detail?.native ||
      detail?.emoji?.native ||
      detail?.emoji?.skins?.[0]?.native ||
      ''
    );
  };

  const bindNativeEmojiClick = (targetEl: HTMLElement, editor: any) => {
    removeNativeEmojiClick?.();

    const handleNativeEmojiClick = (event: Event) => {
      const native = getNativeEmojiFromEvent(event);

      if (native) {
        insertEmojiNative(native, editor);
      }
    };

    targetEl.addEventListener('emoji-click', handleNativeEmojiClick, true);
    removeNativeEmojiClick = () =>
      targetEl.removeEventListener('emoji-click', handleNativeEmojiClick, true);
  };

  return {
    editorEffect: (ctx) => {
      const el = (
        // @ts-ignore
        <Picker
          i18n={i18n}
          data={data}
          onEmojiSelect={(c) => {
            if (c?.native) {
              insertEmojiNative(c.native, ctx.editor);
            }
          }}
        />
      );
      const container = ctx.root.querySelector('.bytemd-toolbar-left');
      const existing = ctx.root.querySelector('.emoji-container') as HTMLElement | null;
      if (existing) {
        panelElement = existing;
        bindNativeEmojiClick(existing, ctx.editor);
        render(el, existing);
        return;
      }

      const targetEl = document.createElement('div');
      targetEl.className = 'emoji-container hidden';

      if (container) {
        container.appendChild(targetEl);
        panelElement = targetEl;
        bindNativeEmojiClick(targetEl, ctx.editor);
        render(el, targetEl);
      }
    },
    actions: [
      {
        title: '表情',
        icon: EMOJI_ICON,
        handler: {
          type: 'action',
          click: ({ root, editor }) => {
            lastSelection = editor.listSelections?.()?.[0] || null;
            const el = root.querySelector('.emoji-container') as HTMLElement | null;

            if (!el) {
              return;
            }

            panelElement = el;

            if (el.classList.contains('hidden')) {
              el.classList.remove('hidden');
              positionPanel(root as HTMLElement);
              setTimeout(() => {
                bindDocumentClick();
              }, 100);
            } else {
              closePanel();
            }
          }
        },
      },
    ],
  };
};
