export const DEFAULT_FRONT_CARD_BACKGROUND_LIGHT = "#ffffff";
export const DEFAULT_FRONT_CARD_BACKGROUND_DARK = "#102033";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const parseHex = (hex: string) => {
  const normalized = normalizeFrontCardColor(hex, DEFAULT_FRONT_CARD_BACKGROUND_LIGHT);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const toHex = (value: number) => clampByte(value).toString(16).padStart(2, "0");

const mixHex = (baseHex: string, targetHex: string, weight: number) => {
  const base = parseHex(baseHex);
  const target = parseHex(targetHex);
  const ratio = Math.max(0, Math.min(1, weight));

  return `#${toHex(base.r + (target.r - base.r) * ratio)}${toHex(
    base.g + (target.g - base.g) * ratio,
  )}${toHex(base.b + (target.b - base.b) * ratio)}`;
};

export const normalizeFrontCardColor = (value?: string, fallback?: string) => {
  const safeFallback = fallback || DEFAULT_FRONT_CARD_BACKGROUND_LIGHT;
  const raw = String(value || "").trim();

  if (!raw) {
    return safeFallback;
  }

  if (!HEX_COLOR_RE.test(raw)) {
    return safeFallback;
  }

  return raw.toLowerCase();
};

export const resolveFrontCardSurfaceColors = (config?: {
  frontCardBackgroundColor?: string;
  frontCardBackgroundColorDark?: string;
}) => {
  const light = normalizeFrontCardColor(
    config?.frontCardBackgroundColor,
    DEFAULT_FRONT_CARD_BACKGROUND_LIGHT,
  );
  const dark = normalizeFrontCardColor(
    config?.frontCardBackgroundColorDark,
    DEFAULT_FRONT_CARD_BACKGROUND_DARK,
  );

  return {
    light,
    lightSoft: mixHex(light, "#eef5fb", 0.16),
    lightDeep: mixHex(light, "#dbe6f3", 0.3),
    dark,
    // Keep the dark palette in the same cyan-blue family as the configured card color
    // so any leftover utility classes no longer fall back to near-black surfaces.
    darkSoft: mixHex(dark, "#193d5d", 0.16),
    darkDeep: mixHex(dark, "#0f2338", 0.22),
    // Page background should stay in the same blue-cyan family as the article card,
    // instead of falling back to a near-black shell behind the content.
    darkPage: mixHex(dark, "#163856", 0.32),
    darkHover: mixHex(dark, "#2d5f86", 0.28),
    darkHoverSoft: mixHex(dark, "#43759b", 0.42),
    darkBorder: mixHex(dark, "#7fa5c0", 0.34),
    darkBorderStrong: mixHex(dark, "#c7dcef", 0.52),
    darkText: mixHex(dark, "#eff9ff", 0.8),
    darkTextMuted: mixHex(dark, "#d2e7f7", 0.62),
    darkTextSoft: mixHex(dark, "#a8c4d8", 0.54),
    darkTextStrong: mixHex(dark, "#ffffff", 0.9),
    darkTextOnAccent: mixHex(dark, "#0d1f31", 0.88),
    darkFill: mixHex(dark, "#e1f2ff", 0.52),
  };
};
