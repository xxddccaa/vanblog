import { useEffect, useRef } from 'react';
import {
  pickSiderWidthUpdate,
  resolveSiderWidth,
  writeCachedSiderWidth,
  type SiderWidthSample,
} from '@/utils/adminSiderWidth';

const SIDER_SELECTOR = 'aside.ant-pro-sider';
const LABEL_SELECTOR = '.ant-menu-title-content';
const LOGO_SELECTOR = '[data-testid="admin-sider-logo"]';
const FOOTER_SELECTOR = '.ant-pro-sider-footer';
// ProLayout shows a skeleton in the sider until the route menu is ready.
const LOADING_SELECTOR = '.ant-skeleton';
// ProLayout marks its sider collapsed one render before antd's Sider does, and the
// menu switches to its collapsed layout in between, so check every signal.
const COLLAPSED_CLASSES = ['ant-pro-sider-collapsed', 'ant-layout-sider-collapsed'];
const COLLAPSED_CONTENT_SELECTOR = '.ant-menu-inline-collapsed, .ant-pro-sider-footer-collapsed';
// Toggled on <body> (outside the observed sider) while reading intrinsic widths.
export const ADMIN_SIDER_MEASURING_CLASS = 'admin-sider-measuring';
// Below this ProLayout shows the menu in a drawer; keep the last desktop width.
const DRAWER_VIEWPORT_WIDTH = 768;
// Collapse/expand animates the sider width for 0.2s; re-measure once it settles.
const SETTLE_DELAY_MS = 320;
const LATE_RENDER_DELAYS_MS = [240, 800];
// While entries are still loading or animating in, keep re-measuring at this pace.
const UNSTABLE_RETRY_MS = 250;
const MAX_UNSTABLE_RETRIES = 40;

const isRendered = (el: Element) => el.getClientRects().length > 0;

const getContentBoxWidth = (el: Element) => {
  const style = window.getComputedStyle(el);
  const horizontalInsets =
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth);
  return (
    el.getBoundingClientRect().width - (Number.isFinite(horizontalInsets) ? horizontalInsets : 0)
  );
};

const isCollapsed = (sider: HTMLElement) =>
  COLLAPSED_CLASSES.some((name) => sider.classList.contains(name)) ||
  sider.querySelector(COLLAPSED_CONTENT_SELECTOR) !== null;

const hasMainMenuEntries = (sider: HTMLElement) =>
  Array.from(sider.querySelectorAll(LABEL_SELECTOR)).some(
    (el) => isRendered(el) && !el.closest(FOOTER_SELECTOR),
  );

// Finite animations inside the sider (e.g. the logo title fading in from display:none)
// mean some entries do not have their final size yet. The sider's own width
// transition is ignored: the fitted width does not depend on the current width.
const hasEntriesInMotion = (sider: HTMLElement) => {
  if (typeof sider.getAnimations !== 'function') {
    return false;
  }
  return sider.getAnimations({ subtree: true }).some((animation) => {
    const effect = animation.effect as KeyframeEffect | null;
    return (
      animation.playState === 'running' &&
      effect?.target !== sider &&
      effect?.getTiming().iterations !== Infinity
    );
  });
};

const isSiderSettled = (sider: HTMLElement) =>
  !sider.querySelector(LOADING_SELECTOR) && hasMainMenuEntries(sider) && !hasEntriesInMotion(sider);

const findSider = () => {
  const sider = document.querySelector<HTMLElement>(SIDER_SELECTOR);
  return sider && isRendered(sider) ? sider : null;
};

export interface SiderWidthMeasurement {
  width: number;
  // False when only part of the content could be measured; see pickSiderWidthUpdate.
  stable: boolean;
}

export const measureSiderWidth = (): SiderWidthMeasurement | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  if (window.innerWidth < DRAWER_VIEWPORT_WIDTH) {
    return null;
  }

  const sider = findSider();
  if (!sider || isCollapsed(sider)) {
    return null;
  }

  const stable = isSiderSettled(sider);
  const siderWidth = sider.getBoundingClientRect().width;
  // Menu labels fill their row, so their laid-out width is the room the sider gives them.
  const labels = Array.from(sider.querySelectorAll(LABEL_SELECTOR)).filter(isRendered);
  const availableWidths = labels.map((el) => el.getBoundingClientRect().width);

  // The logo link sits in a flex row and shrinks to its content, so its available
  // room is the row's content box instead of its own box.
  const logo = sider.querySelector(LOGO_SELECTOR);
  const logoRow = logo && isRendered(logo) ? logo.parentElement : null;
  const logoAvailableWidth = logoRow ? getContentBoxWidth(logoRow) : null;

  const body = document.body;
  let requiredWidths: number[] = [];
  let logoRequiredWidth: number | null = null;
  // Add and remove the class in the same task so the intermediate layout is never painted.
  body.classList.add(ADMIN_SIDER_MEASURING_CLASS);
  try {
    requiredWidths = labels.map((el) => el.getBoundingClientRect().width);
    logoRequiredWidth = logoRow && logo ? logo.getBoundingClientRect().width : null;
  } finally {
    body.classList.remove(ADMIN_SIDER_MEASURING_CLASS);
  }

  const samples: SiderWidthSample[] = labels.map((_, index) => ({
    availableWidth: availableWidths[index],
    requiredWidth: requiredWidths[index],
  }));
  if (logoAvailableWidth !== null && logoRequiredWidth !== null) {
    samples.push({ availableWidth: logoAvailableWidth, requiredWidth: logoRequiredWidth });
  }

  const width = resolveSiderWidth(siderWidth, samples);
  return width === null ? null : { width, stable };
};

interface AdminSiderWidthSyncProps {
  currentWidth: number;
  onChange: (width: number) => void;
}

// Keeps the expanded sider just wide enough for its widest entry. Renders null.
export default function AdminSiderWidthSync({ currentWidth, onChange }: AdminSiderWidthSyncProps) {
  const currentWidthRef = useRef(currentWidth);
  const onChangeRef = useRef(onChange);
  currentWidthRef.current = currentWidth;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined;
    }

    let disposed = false;
    let frameId = 0;
    let observedSider: HTMLElement | null = null;
    const timers = new Set<number>();
    let unstableRetries = 0;

    let scheduleMeasurement: () => void = () => undefined;

    const scheduleAfter = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        scheduleMeasurement();
      }, delay);
      timers.add(timer);
    };

    // Menu text, badge counts and opened submenus change the content width.
    const contentObserver = new MutationObserver(() => scheduleMeasurement());
    // Collapse/expand toggles a class on the sider itself; wait for the animation.
    const stateObserver = new MutationObserver(() => {
      scheduleMeasurement();
      scheduleAfter(SETTLE_DELAY_MS);
    });

    // ProLayout can re-create the sider (e.g. after a layout-less route), so rebind lazily.
    const bindObservers = () => {
      const sider = findSider();
      if (!sider || sider === observedSider) {
        return;
      }
      contentObserver.disconnect();
      stateObserver.disconnect();
      contentObserver.observe(sider, { childList: true, characterData: true, subtree: true });
      stateObserver.observe(sider, { attributes: true, attributeFilter: ['class'] });
      observedSider = sider;
    };

    const applyMeasurement = () => {
      frameId = 0;
      if (disposed) {
        return;
      }
      bindObservers();
      const measurement = measureSiderWidth();
      if (measurement === null) {
        return;
      }
      if (measurement.stable) {
        unstableRetries = 0;
        writeCachedSiderWidth(measurement.width);
      } else if (unstableRetries < MAX_UNSTABLE_RETRIES) {
        unstableRetries += 1;
        scheduleAfter(UNSTABLE_RETRY_MS);
      }
      const next = pickSiderWidthUpdate(
        currentWidthRef.current,
        measurement.width,
        measurement.stable,
      );
      if (next !== null) {
        onChangeRef.current(next);
      }
    };

    scheduleMeasurement = () => {
      if (!disposed && !frameId) {
        frameId = window.requestAnimationFrame(applyMeasurement);
      }
    };

    const handleFontsLoaded = () => scheduleMeasurement();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;

    scheduleMeasurement();
    LATE_RENDER_DELAYS_MS.forEach(scheduleAfter);
    window.addEventListener('resize', scheduleMeasurement);
    fonts?.ready?.then(handleFontsLoaded).catch(() => undefined);
    fonts?.addEventListener?.('loadingdone', handleFontsLoaded);

    return () => {
      disposed = true;
      contentObserver.disconnect();
      stateObserver.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      window.removeEventListener('resize', scheduleMeasurement);
      fonts?.removeEventListener?.('loadingdone', handleFontsLoaded);
    };
  }, []);

  return null;
}
