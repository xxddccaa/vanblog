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
      bodyClassName: "dark",
      bodyDataTheme: "dark",
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

  it("supports custom first-paint background colors", () => {
    const snapshot = getThemeSnapshot({
      defaultTheme: "dark",
      lightBackground: "#f5fbff",
      darkBackground: "#0f2338",
    });
    const script = getThemeBootstrapScript("dark", {
      lightBackground: "#f5fbff",
      darkBackground: "#0f2338",
    });

    expect(snapshot.backgroundColor).toBe("#0f2338");
    expect(script).toContain('var LIGHT_BG="#f5fbff"');
    expect(script).toContain('var DARK_BG="#0f2338"');
  });
});
