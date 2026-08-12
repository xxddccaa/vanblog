import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MarkdownThemeResources, {
  MARKDOWN_THEME_HOTFIX_PRECEDENCE,
  MARKDOWN_THEME_PRECEDENCE,
} from "../components/Layout/MarkdownThemeResources";
import {
  MARKDOWN_THEME_HOTFIX_URL,
  withMarkdownThemeAssetVersion,
} from "../utils/markdownTheme";

describe("layout markdown theme SSR resources", () => {
  it("hoists versioned theme stylesheets into the server head before body content", () => {
    const html = renderToStaticMarkup(
      <html>
        <head />
        <body>
          <MarkdownThemeResources
            enabled
            lightThemeUrl="/markdown-themes/light.css"
            darkThemeUrl="/markdown-themes/dark.css"
          />
          <main>page content</main>
        </body>
      </html>,
    );

    const bodyIndex = html.indexOf("<body>");
    const lightIndex = html.indexOf(
      withMarkdownThemeAssetVersion("/markdown-themes/light.css"),
    );
    const darkIndex = html.indexOf(
      withMarkdownThemeAssetVersion("/markdown-themes/dark.css"),
    );
    const hotfixIndex = html.indexOf(
      withMarkdownThemeAssetVersion(MARKDOWN_THEME_HOTFIX_URL),
    );

    expect(lightIndex).toBeGreaterThan(-1);
    expect(darkIndex).toBeGreaterThan(lightIndex);
    expect(hotfixIndex).toBeGreaterThan(darkIndex);
    expect(hotfixIndex).toBeLessThan(bodyIndex);
    expect(html).toContain(
      `data-precedence="${MARKDOWN_THEME_PRECEDENCE}"`,
    );
    expect(html).toContain(
      `data-precedence="${MARKDOWN_THEME_HOTFIX_PRECEDENCE}"`,
    );
  });

  it("does not emit theme resources for non-rich pages", () => {
    const html = renderToStaticMarkup(
      <html>
        <head />
        <body>
          <MarkdownThemeResources
            lightThemeUrl="/markdown-themes/light.css"
            darkThemeUrl="/markdown-themes/dark.css"
          />
          <main>page content</main>
        </body>
      </html>,
    );

    expect(html).not.toContain("data-vanblog-theme-link");
    expect(html).not.toContain("data-vanblog-theme-hotfix");
  });
});
