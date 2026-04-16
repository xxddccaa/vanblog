// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "../utils/theme";

describe("theme utils", () => {
  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    document.body.className = "";
    document.body.removeAttribute("data-theme");
    document.body.removeAttribute("style");
  });

  it("prefers the configured front-page CSS variable when applying dark mode", () => {
    document.documentElement.style.setProperty("--vb-front-page-bg-dark", "#12283e");

    applyTheme("dark", "test", true);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.backgroundColor).toBe("rgb(18, 40, 62)");
    expect(document.body.style.backgroundColor).toBe("rgb(18, 40, 62)");
  });
});
