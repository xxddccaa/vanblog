import type { BytemdPlugin } from 'bytemd';

import { useState } from 'react';
import { render } from 'react-dom';

import TextColorControls from '../MarkdownEditor/TextColorControls';
import {
  DEFAULT_TEXT_COLOR,
  TEXT_COLOR_PLACEHOLDER,
  buildTextColorSnippet,
  normalizeTextColor,
} from '../MarkdownEditor/utils';

const TEXT_COLOR_ICON =
  '<svg data-vb-text-color-icon="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 1024 1024"><path d="M278 820h468a48 48 0 0 1 0 96H278a48 48 0 0 1 0-96zM455.6 133.6a64 64 0 0 1 112.8 0l248 520A48 48 0 1 1 729.7 695L678 586H346l-51.7 109a48 48 0 1 1-86.7-41.4l248-520zM391.6 490h240.8L512 237.6 391.6 490z"/></svg>';

const isSamePosition = (a?: { line: number; ch: number }, b?: { line: number; ch: number }) =>
  Boolean(a && b && a.line === b.line && a.ch === b.ch);

function TextColorPanel(props: {
  onApply: (color: string) => void;
  onClose: () => void;
}) {
  const [color, setColor] = useState<string>(DEFAULT_TEXT_COLOR);

  return (
    <TextColorControls
      value={color}
      onChange={setColor}
      onApply={props.onApply}
      onClose={props.onClose}
      compact
    />
  );
}

export function textColor(): BytemdPlugin {
  let panelElement: HTMLElement | null = null;
  let activeContext: any = null;
  let lastSelection: any = null;
  let activeButton: HTMLElement | null = null;

  const closePanel = () => {
    panelElement?.classList.add('hidden');
    activeButton?.classList.remove('vb-text-color-button-active');
    activeButton = null;
  };

  const positionPanel = (ctx: any) => {
    if (!panelElement) {
      return;
    }

    const toolbar = ctx.root.querySelector('.bytemd-toolbar') as HTMLElement | null;
    const button = ctx.root
      .querySelector('[data-vb-text-color-icon="true"]')
      ?.closest('.bytemd-toolbar-icon') as HTMLElement | null;

    if (!toolbar || !button) {
      return;
    }

    const toolbarRect = toolbar.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const panelWidth = panelElement.offsetWidth || 260;

    let left = buttonRect.left - toolbarRect.left;
    if (left + panelWidth > toolbarRect.width) {
      left = toolbarRect.width - panelWidth;
    }
    if (left < 0) left = 0;

    panelElement.style.left = `${left}px`;
    panelElement.style.top = `${toolbarRect.height}px`;

    activeButton?.classList.remove('vb-text-color-button-active');
    activeButton = button;
    activeButton.classList.add('vb-text-color-button-active');
  };

  const applyColor = (rawColor: string) => {
    const ctx = activeContext;

    if (!ctx?.editor) {
      closePanel();
      return;
    }

    const color = normalizeTextColor(rawColor);
    const { codemirror, editor } = ctx;

    if (lastSelection?.anchor && lastSelection?.head) {
      editor.setSelection(lastSelection.anchor, lastSelection.head);
    }

    editor.focus();

    const selection = editor.listSelections?.()?.[0] || lastSelection;
    const isEmptySelection =
      !selection || isSamePosition(selection.anchor, selection.head);
    const selectedText = isEmptySelection
      ? TEXT_COLOR_PLACEHOLDER
      : editor.getSelection?.() || TEXT_COLOR_PLACEHOLDER;
    const snippet = buildTextColorSnippet(selectedText, color);
    const insertionPoint = selection?.anchor;

    editor.replaceSelection(snippet);

    if (isEmptySelection && insertionPoint && codemirror?.Pos) {
      const prefixLength = `<span style="color:${color}">`.length;
      editor.setSelection(
        codemirror.Pos(insertionPoint.line, insertionPoint.ch + prefixLength),
        codemirror.Pos(
          insertionPoint.line,
          insertionPoint.ch + prefixLength + TEXT_COLOR_PLACEHOLDER.length,
        ),
      );
    }

    editor.focus();
    lastSelection = editor.listSelections?.()?.[0] || null;
    closePanel();
  };

  return {
    editorEffect: (ctx) => {
      const bytemdRoot = ctx.root.querySelector('.bytemd') || ctx.root;

      if (!bytemdRoot) {
        return;
      }

      const existing = ctx.root.querySelector('.vb-text-color-container') as HTMLElement | null;
      if (existing) {
        panelElement = existing;
        render(<TextColorPanel onApply={applyColor} onClose={closePanel} />, existing);
        return;
      }

      const targetEl = document.createElement('div');
      targetEl.className = 'vb-text-color-container hidden';
      bytemdRoot.appendChild(targetEl);
      panelElement = targetEl;

      render(<TextColorPanel onApply={applyColor} onClose={closePanel} />, targetEl);
    },
    actions: [
      {
        position: 'left',
        title: '文字颜色',
        icon: TEXT_COLOR_ICON,
        handler: {
          type: 'action',
          click(ctx) {
            activeContext = ctx;
            lastSelection = ctx.editor.listSelections?.()?.[0] || null;

            const targetEl = ctx.root.querySelector('.vb-text-color-container') as HTMLElement | null;
            if (targetEl) {
              panelElement = targetEl;

              if (targetEl.classList.contains('hidden')) {
                targetEl.classList.remove('hidden');
                positionPanel(ctx);
              } else {
                closePanel();
              }
            }
          },
        },
      },
    ],
  };
}
