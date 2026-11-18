// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HelpTip from '../components/Comments/HelpTip';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('comment form help tip', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <div className="relative">
          <HelpTip label="个人网站">填写你自己的博客地址。</HelpTip>
        </div>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('describes the button with the tooltip text', () => {
    const button = container.querySelector('button')!;
    const tooltip = container.querySelector('[role="tooltip"]')!;
    expect(button.getAttribute('aria-label')).toBe('个人网站说明');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.textContent).toBe('填写你自己的博客地址。');
  });

  it('toggles on tap and closes on Escape', () => {
    const button = container.querySelector('button')!;
    const tooltip = container.querySelector('[role="tooltip"]')!;
    expect(tooltip.className).toContain('invisible');
    act(() => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(tooltip.className).toContain('visible opacity-100');
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(tooltip.className).toContain('invisible');
  });
});
