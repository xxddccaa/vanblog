export const DEFAULT_FRONT_CARD_BACKGROUND_LIGHT = "#ffffff";
export const DEFAULT_FRONT_CARD_BACKGROUND_DARK = "#111315";

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
    darkSoft: mixHex(dark, "#181b1f", 0.16),
    darkDeep: mixHex(dark, "#0b0d10", 0.22),
    darkPage: mixHex(dark, "#0d0f12", 0.28),
    darkHover: mixHex(dark, "#1d2127", 0.24),
    darkHoverSoft: mixHex(dark, "#252a31", 0.38),
    darkBorder: mixHex(dark, "#3a424c", 0.28),
    darkBorderStrong: mixHex(dark, "#55606d", 0.42),
    darkText: mixHex(dark, "#eef2f6", 0.82),
    darkTextMuted: mixHex(dark, "#c2cad3", 0.62),
    darkTextSoft: mixHex(dark, "#97a0ab", 0.5),
    darkTextStrong: mixHex(dark, "#ffffff", 0.9),
    darkTextOnAccent: mixHex(dark, "#111315", 0.9),
    darkFill: mixHex(dark, "#d7dee6", 0.46),
  };
};
