import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_SIDER_MAX_WIDTH,
  ADMIN_SIDER_MIN_WIDTH,
  ADMIN_SIDER_WIDTH_BUFFER,
  ADMIN_SIDER_WIDTH_STORAGE_KEY,
  getInitialSiderWidth,
  isSiderWidthChange,
  pickSiderWidthUpdate,
  readCachedSiderWidth,
  resolveSiderWidth,
  writeCachedSiderWidth,
} from './adminSiderWidth';

describe('resolveSiderWidth', () => {
  it('fits the widest entry plus the fixed chrome around it', () => {
    // Chrome is 256 - 180 = 76px; the widest entry needs 90px.
    const width = resolveSiderWidth(256, [
      { availableWidth: 180, requiredWidth: 64 },
      { availableWidth: 180, requiredWidth: 90 },
      { availableWidth: 156, requiredWidth: 40 },
    ]);
    expect(width).toBe(76 + 90 + ADMIN_SIDER_WIDTH_BUFFER);
  });

  it('accounts for entries with more chrome, such as indented submenu items', () => {
    const width = resolveSiderWidth(256, [
      { availableWidth: 180, requiredWidth: 64 },
      // Indented child: 106px of chrome around a 64px label.
      { availableWidth: 150, requiredWidth: 64 },
    ]);
    expect(width).toBe(106 + 64 + ADMIN_SIDER_WIDTH_BUFFER);
  });

  it('rounds fractional widths up', () => {
    expect(resolveSiderWidth(256, [{ availableWidth: 180, requiredWidth: 80.2 }])).toBe(
      Math.ceil(76 + 80.2 + ADMIN_SIDER_WIDTH_BUFFER),
    );
  });

  it('is stable when the result is fed back in', () => {
    const first = resolveSiderWidth(256, [{ availableWidth: 180, requiredWidth: 70 }]);
    expect(first).not.toBeNull();
    // At the fitted width the label row shrinks by the same amount as the sider.
    const shrink = 256 - (first as number);
    const second = resolveSiderWidth(first as number, [
      { availableWidth: 180 - shrink, requiredWidth: 70 },
    ]);
    expect(second).toBe(first);
  });

  it('clamps to the configured bounds', () => {
    expect(resolveSiderWidth(256, [{ availableWidth: 180, requiredWidth: 2 }])).toBe(
      ADMIN_SIDER_MIN_WIDTH,
    );
    expect(resolveSiderWidth(256, [{ availableWidth: 180, requiredWidth: 400 }])).toBe(
      ADMIN_SIDER_MAX_WIDTH,
    );
  });

  it('returns null without usable samples or sider width', () => {
    expect(resolveSiderWidth(256, [])).toBeNull();
    expect(resolveSiderWidth(256, [{ availableWidth: Number.NaN, requiredWidth: 10 }])).toBeNull();
    expect(resolveSiderWidth(0, [{ availableWidth: 180, requiredWidth: 70 }])).toBeNull();
  });
});

describe('isSiderWidthChange', () => {
  it('ignores sub-tolerance jitter', () => {
    expect(isSiderWidthChange(160, 161)).toBe(false);
    expect(isSiderWidthChange(160, 162)).toBe(true);
    expect(isSiderWidthChange(undefined, 160)).toBe(true);
  });
});

describe('pickSiderWidthUpdate', () => {
  it('applies stable measurements in both directions', () => {
    expect(pickSiderWidthUpdate(256, 161, true)).toBe(161);
    expect(pickSiderWidthUpdate(161, 180, true)).toBe(180);
    expect(pickSiderWidthUpdate(161, 162, true)).toBeNull();
  });

  it('lets unstable measurements widen but never narrow the sider', () => {
    expect(pickSiderWidthUpdate(161, 144, false)).toBeNull();
    expect(pickSiderWidthUpdate(161, 161, false)).toBeNull();
    expect(pickSiderWidthUpdate(161, 200, false)).toBe(200);
    expect(pickSiderWidthUpdate(undefined, 144, false)).toBe(144);
  });
});

describe('sider width cache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a valid width', () => {
    writeCachedSiderWidth(168);
    expect(readCachedSiderWidth()).toBe(168);
    expect(getInitialSiderWidth()).toBe(168);
  });

  it('ignores invalid or out-of-range stored values', () => {
    for (const raw of ['abc', '12', '999', '160.5', '']) {
      window.localStorage.setItem(ADMIN_SIDER_WIDTH_STORAGE_KEY, raw);
      expect(readCachedSiderWidth()).toBeNull();
    }
    expect(getInitialSiderWidth()).toBe(ADMIN_SIDER_MAX_WIDTH);
  });

  it('does not store out-of-range widths', () => {
    writeCachedSiderWidth(20);
    expect(window.localStorage.getItem(ADMIN_SIDER_WIDTH_STORAGE_KEY)).toBeNull();
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readCachedSiderWidth()).toBeNull();
    expect(() => writeCachedSiderWidth(168)).not.toThrow();
    expect(getInitialSiderWidth()).toBe(ADMIN_SIDER_MAX_WIDTH);
  });

  it('prefers the in-memory state width over the cache', () => {
    writeCachedSiderWidth(168);
    expect(getInitialSiderWidth(180)).toBe(180);
    expect(getInitialSiderWidth(10)).toBe(168);
  });
});
