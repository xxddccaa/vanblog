import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("../components/AlertCard", () => ({
  default: () => React.createElement("div", null, "alert-card"),
}));

vi.mock("../components/CopyRight", () => ({
  default: () => React.createElement("div", null, "copyright-card"),
}));

vi.mock("../components/Reward", () => ({
  default: () => React.createElement("div", null, "reward-card"),
}));

vi.mock("../components/TopPinIcon", () => ({
  default: () => React.createElement("div", null, "top-pin"),
}));

vi.mock("../components/UnLockCard", () => ({
  default: () => React.createElement("div", null, "unlock-card"),
}));

vi.mock("../components/WaLine", () => ({
  default: () => React.createElement("div", null, "waline"),
}));

vi.mock("../components/TocMobile", () => ({
  default: () => React.createElement("div", null, "toc-mobile"),
}));

vi.mock("../components/Markdown", () => ({
  default: ({ content }: { content: string }) => React.createElement("div", null, content),
}));

vi.mock("../components/PostViewerStats", () => ({
  default: () => React.createElement("div", { "data-fragment": "engagement" }, "engagement-fragment"),
}));

vi.mock("../components/PostCard/bottom", () => ({
  PostBottom: ({
    type,
    lock,
  }: {
    type: "overview" | "article" | "about";
    lock: boolean;
  }) =>
    type === "article" && !lock
      ? React.createElement("div", { "data-fragment": "nav" }, "nav-fragment")
      : null,
}));

vi.mock("../components/PostCard/fragments", () => ({
  default: () => React.createElement("div", { "data-fragment": "fragments" }, "article-fragments"),
}));

describe("post fragment composition", () => {
  it("mounts exactly the three dedicated dynamic fragment blocks on article detail cards", async () => {
    const { default: PostCard } = await import("../components/PostCard");

    const html = renderToStaticMarkup(
      React.createElement(PostCard, {
        id: 7,
        title: "Edge Cache Post",
        updatedAt: new Date("2026-04-11T00:00:00.000Z"),
        createdAt: new Date("2026-04-09T00:00:00.000Z"),
        catelog: "Architecture",
        content: "post body",
        setContent: () => undefined,
        type: "article",
        pay: ["/ali.png", "/wechat.png"],
        payDark: ["/ali-dark.png", "/wechat-dark.png"],
        author: "Article Author",
        tags: ["cache"],
        enableComment: "true",
        top: 0,
        private: false,
        openArticleLinksInNewWindow: false,
        copyrightAggreement: "CC BY-NC-SA 4.0",
        customCopyRight: null,
        showExpirationReminder: true,
        showEditButton: false,
      }),
    );

    expect(html.match(/data-fragment="engagement"/g) || []).toHaveLength(1);
    expect(html.match(/data-fragment="nav"/g) || []).toHaveLength(1);
    expect(html.match(/data-fragment="fragments"/g) || []).toHaveLength(1);
    expect(html).not.toContain("阅读全文");
  });

  it("does not mount dynamic fragment blocks on overview cards", async () => {
    const { default: PostCard } = await import("../components/PostCard");

    const html = renderToStaticMarkup(
      React.createElement(PostCard, {
        id: 7,
        title: "Edge Cache Overview",
        updatedAt: new Date("2026-04-11T00:00:00.000Z"),
        createdAt: new Date("2026-04-09T00:00:00.000Z"),
        catelog: "Architecture",
        content: "preview<!-- more -->post body",
        setContent: () => undefined,
        type: "overview",
        author: "Article Author",
        tags: ["cache"],
        enableComment: "true",
        top: 0,
        private: false,
        openArticleLinksInNewWindow: false,
        copyrightAggreement: "CC BY-NC-SA 4.0",
        customCopyRight: null,
        showExpirationReminder: true,
        showEditButton: false,
      }),
    );

    expect(html).toContain("阅读全文");
    expect(html).not.toContain('data-fragment="engagement"');
    expect(html).not.toContain('data-fragment="nav"');
    expect(html).not.toContain('data-fragment="fragments"');
  });
});
