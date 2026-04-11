import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SiteStatsSummary from "../components/SiteStatsSummary";

vi.mock("../api/getSiteStats", () => ({
  getSiteStats: vi.fn(),
}));

describe("site stats summary cache shell", () => {
  it("keeps site stats out of the server-rendered html even when fallback values exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(SiteStatsSummary, {
        className: "summary",
        fallback: {
          categoryNum: 5,
          postNum: 12,
          tagNum: 8,
          totalWordCount: 9999,
        },
      }),
    );

    expect(html).toContain("-- 分类 × -- 文章 × -- 标签 × -- 字");
    expect(html).not.toContain("5 分类");
    expect(html).not.toContain("12 文章");
    expect(html).not.toContain("8 标签");
    expect(html).not.toContain("9999 字");
  });
});
