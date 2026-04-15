import { describe, expect, it } from "vitest";
import {
  getThemePreferenceFromCookie,
  getThemeBootstrapScript,
  getThemeSnapshot,
  normalizeThemePreference,
  resolveDocumentTheme,
} from "../utils/themeBoot";

describe("theme boot", () => {
  it("prefers the persisted theme over the site default", () => {
    expect(
      resolveDocumentTheme({
        defaultTheme: "light",
        preferredTheme: "dark",
      }),
    ).toBe("dark");
  });

  it("falls back to the site default before hydration", () => {
    expect(
      getThemeSnapshot({
        defaultTheme: "dark",
        preferredTheme: null,
      }),
    ).toMatchObject({
      className: "dark",
      dataTheme: "dark",
      colorScheme: "dark",
    });
  });

  it("normalizes legacy auto preferences to dark", () => {
    expect(normalizeThemePreference("auto")).toBe("dark");
    expect(getThemePreferenceFromCookie("theme=auto; locale=zh-CN")).toBe("dark");
  });

  it("embeds the provided default theme into the bootstrap script without system-theme branching", () => {
    const script = getThemeBootstrapScript("light");

    expect(script).toContain('var DEFAULT_THEME="light"');
    expect(script).not.toContain("matchMedia");
  });
});
