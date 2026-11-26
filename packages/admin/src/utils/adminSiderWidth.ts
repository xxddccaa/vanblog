// Width of the expanded admin sider, fitted to the widest menu entry.

// The previous hard-coded ProLayout width; the fitted sider never grows past it.
export const ADMIN_SIDER_MAX_WIDTH = 256;
// Floor used when a measurement comes back unexpectedly small.
export const ADMIN_SIDER_MIN_WIDTH = 144;
// Extra room so sub-pixel text rendering never triggers an ellipsis.
export const ADMIN_SIDER_WIDTH_BUFFER = 4;
// Changes smaller than this are ignored to avoid layout churn.
export const ADMIN_SIDER_WIDTH_TOLERANCE = 2;
export const ADMIN_SIDER_WIDTH_STORAGE_KEY = 'vanblog.admin.sider.width';

export interface SiderWidthSample {
  // Width the entry currently gets from the sider layout.
  availableWidth: number;
  // Width the entry needs to show its content without truncation.
  requiredWidth: number;
}

export const clampSiderWidth = (width: number): number =>
  Math.min(ADMIN_SIDER_MAX_WIDTH, Math.max(ADMIN_SIDER_MIN_WIDTH, Math.ceil(width)));

const isUsableNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Returns the sider width that fits every sampled entry.
 *
 * `siderWidth - availableWidth` is the fixed chrome around an entry (menu padding,
 * item margins, indent, submenu arrow), so adding the entry's required width gives
 * the sider width it needs. Feeding the result back in yields the same width.
 */
export const resolveSiderWidth = (
  siderWidth: number,
  samples: SiderWidthSample[],
): number | null => {
  if (!isUsableNumber(siderWidth) || siderWidth === 0) {
    return null;
  }

  let needed = 0;
  let hasSample = false;
  for (const sample of samples) {
    if (!isUsableNumber(sample?.availableWidth) || !isUsableNumber(sample?.requiredWidth)) {
      continue;
    }
    hasSample = true;
    needed = Math.max(needed, siderWidth - sample.availableWidth + sample.requiredWidth);
  }

  if (!hasSample) {
    return null;
  }

  return clampSiderWidth(needed + ADMIN_SIDER_WIDTH_BUFFER);
};

export const isSiderWidthChange = (current: number | undefined, next: number): boolean =>
  !isUsableNumber(current) || Math.abs(current - next) >= ADMIN_SIDER_WIDTH_TOLERANCE;

/**
 * Decides whether a measurement should replace the current width.
 *
 * An unstable measurement (menu still loading, entries mid-animation) only sees part
 * of the content, so it is a lower bound: it may widen the sider but never narrow it.
 */
export const pickSiderWidthUpdate = (
  current: number | undefined,
  measured: number,
  stable: boolean,
): number | null => {
  if (!stable && isUsableNumber(current) && measured <= current) {
    return null;
  }
  return isSiderWidthChange(current, measured) ? measured : null;
};

const isValidStoredWidth = (value: number): boolean =>
  Number.isInteger(value) && value >= ADMIN_SIDER_MIN_WIDTH && value <= ADMIN_SIDER_MAX_WIDTH;

export const readCachedSiderWidth = (): number | null => {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = window.localStorage.getItem(ADMIN_SIDER_WIDTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return isValidStoredWidth(value) ? value : null;
  } catch (err) {
    return null;
  }
};

export const writeCachedSiderWidth = (width: number): void => {
  try {
    if (typeof window === 'undefined' || !isValidStoredWidth(width)) {
      return;
    }
    window.localStorage.setItem(ADMIN_SIDER_WIDTH_STORAGE_KEY, String(width));
  } catch (err) {
    // Storage can be unavailable (private mode, quota); the width is just not cached.
  }
};

export const getInitialSiderWidth = (stateWidth?: number | null): number => {
  if (typeof stateWidth === 'number' && isValidStoredWidth(stateWidth)) {
    return stateWidth;
  }
  return readCachedSiderWidth() ?? ADMIN_SIDER_MAX_WIDTH;
};
