// @vitest-environment jsdom
import Headroom from 'headroom.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('real Headroom lifecycle', () => {
  let headroom: Headroom;
  let element: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    element = document.createElement('div');
    document.body.append(element);
    headroom = new Headroom(element);
  });

  afterEach(() => {
    headroom.destroy();
    element.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([0, 99])('cancels registration when destroyed after %i ms', (delay) => {
    const add = vi.spyOn(window, 'addEventListener');
    headroom.init();
    vi.advanceTimersByTime(delay);
    expect(() => headroom.destroy()).not.toThrow();
    vi.advanceTimersByTime(200);
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0);
    expect(element.classList.contains('headroom')).toBe(false);
  });

  it('removes a registered listener and permits repeated destroy', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    headroom.init();
    vi.advanceTimersByTime(100);
    const scrollCalls = add.mock.calls.filter(([type]) => type === 'scroll');
    expect(scrollCalls).toHaveLength(1);
    headroom.destroy();
    headroom.destroy();
    expect(remove.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
    expect(remove).toHaveBeenCalledWith(...scrollCalls[0]);
  });

  it('supports the init-cleanup-init sequence used by StrictMode', () => {
    const add = vi.spyOn(window, 'addEventListener');
    headroom.init();
    headroom.destroy();
    headroom.init();
    vi.advanceTimersByTime(200);
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
    expect(element.classList.contains('headroom')).toBe(true);
  });
});
