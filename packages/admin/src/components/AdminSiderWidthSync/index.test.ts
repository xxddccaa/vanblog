import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_SIDER_MIN_WIDTH, ADMIN_SIDER_WIDTH_BUFFER } from '@/utils/adminSiderWidth';
import { ADMIN_SIDER_MEASURING_CLASS, measureSiderWidth } from './index';

type Box = { normal: number; measuring: number };

// jsdom has no layout engine, so each element reports a fixed width that changes
// while the measuring class is on <body>, like the real CSS does.
const stubWidth = (el: Element, box: Box) => {
  el.getBoundingClientRect = () => {
    const width = document.body.classList.contains(ADMIN_SIDER_MEASURING_CLASS)
      ? box.measuring
      : box.normal;
    return { width, height: 20, top: 0, left: 0, right: width, bottom: 20, x: 0, y: 0 } as DOMRect;
  };
  el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
};

// Fakes the Web Animations API result for an element (jsdom does not implement it).
const stubAnimations = (
  el: HTMLElement,
  animations: { target: Element | null; iterations: number }[],
) => {
  el.getAnimations = () =>
    animations.map(({ target, iterations }) => ({
      playState: 'running',
      effect: { target, getTiming: () => ({ iterations }) },
    })) as unknown as Animation[];
};

const buildSider = ({ siderClass = '', menuClass = '', loading = false } = {}) => {
  document.body.innerHTML = `
    <aside class="ant-pro-sider ${siderClass}">
      ${loading ? '<div class="ant-skeleton"></div>' : ''}
      <div class="logo-row" style="padding-left: 12px; padding-right: 12px">
        <a data-testid="admin-sider-logo">VanBlog</a>
      </div>
      <ul class="${menuClass}">
        <li><span class="ant-menu-title-content" id="short">short</span></li>
        <li><span class="ant-menu-title-content" id="long">long</span></li>
      </ul>
      <div class="ant-pro-sider-footer">
        <ul><li><span class="ant-menu-title-content" id="footer">footer</span></li></ul>
      </div>
    </aside>`;
  const sider = document.querySelector('aside') as HTMLElement;
  stubWidth(sider, { normal: 256, measuring: 256 });
  stubWidth(document.querySelector('.logo-row') as Element, { normal: 256, measuring: 256 });
  stubWidth(document.querySelector('[data-testid="admin-sider-logo"]') as Element, {
    normal: 120,
    measuring: 120,
  });
  stubWidth(document.getElementById('short') as Element, { normal: 180, measuring: 64 });
  stubWidth(document.getElementById('long') as Element, { normal: 180, measuring: 96 });
  stubWidth(document.getElementById('footer') as Element, { normal: 180, measuring: 40 });
  return sider;
};

describe('measureSiderWidth', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    document.body.innerHTML = '';
    document.body.className = '';
  });

  it('fits the widest label and leaves no measuring class behind', () => {
    buildSider();
    // Label chrome is 256 - 180 = 76px; the long label needs 96px.
    expect(measureSiderWidth()).toEqual({
      width: 76 + 96 + ADMIN_SIDER_WIDTH_BUFFER,
      stable: true,
    });
    expect(document.body.classList.contains(ADMIN_SIDER_MEASURING_CLASS)).toBe(false);
  });

  it('marks the measurement unstable while the menu skeleton is shown', () => {
    buildSider({ loading: true });
    expect(measureSiderWidth()?.stable).toBe(false);
  });

  it('marks the measurement unstable when only footer entries are rendered', () => {
    buildSider();
    document.querySelectorAll('ul:not(.ant-pro-sider-footer ul)').forEach((ul) => ul.remove());
    expect(measureSiderWidth()).toEqual({
      width: ADMIN_SIDER_MIN_WIDTH,
      stable: false,
    });
  });

  it('marks the measurement unstable while an entry is animating in', () => {
    const sider = buildSider();
    const h1 = document.createElement('h1');
    sider.appendChild(h1);
    stubAnimations(sider, [{ target: h1, iterations: 1 }]);
    expect(measureSiderWidth()?.stable).toBe(false);
  });

  it('ignores the sider width transition and infinite animations', () => {
    const sider = buildSider();
    stubAnimations(sider, [
      { target: sider, iterations: 1 },
      { target: null, iterations: Infinity },
    ]);
    expect(measureSiderWidth()?.stable).toBe(true);
  });

  it('skips a collapsed sider', () => {
    buildSider({ siderClass: 'ant-pro-sider-collapsed ant-layout-sider-collapsed' });
    expect(measureSiderWidth()).toBeNull();
  });

  it('skips the render where only ProLayout has marked the sider collapsed', () => {
    buildSider({ siderClass: 'ant-pro-sider-collapsed' });
    expect(measureSiderWidth()).toBeNull();
  });

  it('skips a sider whose menu is already in collapsed layout', () => {
    buildSider({ menuClass: 'ant-menu-inline-collapsed' });
    expect(measureSiderWidth()).toBeNull();
  });

  it('skips the mobile drawer viewport', () => {
    buildSider();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    expect(measureSiderWidth()).toBeNull();
  });

  it('returns null without a sider', () => {
    expect(measureSiderWidth()).toBeNull();
  });
});
