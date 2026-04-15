import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LayoutBody from "../components/LayoutBody";

describe("LayoutBody", () => {
  it("keeps the legacy article width for standard mode", () => {
    const html = renderToStaticMarkup(
      <LayoutBody contentWidthMode="standard" sideBar={null}>
        <div>content</div>
      </LayoutBody>,
    );

    expect(html).toContain("md:max-w-3xl");
    expect(html).toContain("xl:max-w-4xl");
  });

  it("expands the main content width for wide, ultraWide, and full modes", () => {
    const wideHtml = renderToStaticMarkup(
      <LayoutBody contentWidthMode="wide" sideBar={<aside>toc</aside>}>
        <div>content</div>
      </LayoutBody>,
    );
    const ultraWideHtml = renderToStaticMarkup(
      <LayoutBody contentWidthMode="ultraWide" sideBar={<aside>toc</aside>}>
        <div>content</div>
      </LayoutBody>,
    );
    const fullHtml = renderToStaticMarkup(
      <LayoutBody contentWidthMode="full" sideBar={<aside>toc</aside>}>
        <div>content</div>
      </LayoutBody>,
    );

    expect(wideHtml).toContain("md:max-w-4xl");
    expect(wideHtml).toContain("xl:max-w-5xl");
    expect(ultraWideHtml).toContain("md:max-w-4xl");
    expect(ultraWideHtml).toContain("xl:max-w-6xl");
    expect(ultraWideHtml).toContain("vanblog-sider");
    expect(fullHtml).toContain("max-w-none");
    expect(fullHtml).toContain("vanblog-sider");
  });
});
