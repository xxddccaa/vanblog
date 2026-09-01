import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const getMomentPageProps = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    ({ content }: { content: string }) =>
      React.createElement("div", { "data-client-markdown": "true" }, content),
}));

vi.mock("../components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("../components/AuthorCard", () => ({
  default: () => React.createElement("aside", null, "author"),
}));

vi.mock("../components/LinkCard", () => ({
  default: ({ link }: { link: { name: string } }) =>
    React.createElement("div", null, link.name),
}));

vi.mock("../components/WaLine", () => ({
  default: () => React.createElement("div", null, "comments"),
}));

vi.mock("../components/ImageUpload", () => ({
  default: () => React.createElement("button", null, "upload"),
}));

vi.mock("../components/TopPinIcon", () => ({
  default: () => React.createElement("span", null, "top"),
}));

vi.mock("../components/RenderedMarkdown", () => ({
  default: ({
    html,
    content,
  }: {
    html: string;
    content: string;
  }) =>
    React.createElement("div", {
      "data-rendered-markdown": "true",
      "data-content": content,
      dangerouslySetInnerHTML: { __html: html },
    }),
}));

vi.mock("../api/getMoments", () => ({
  getMoments: vi.fn(),
  createMoment: vi.fn(),
}));

vi.mock("../utils/getPageProps", () => ({
  getMomentPageProps,
}));

describe("active route markdown boundaries", () => {
  it("renders homepage previews from server-produced html", async () => {
    const { default: OverviewPostCard } = await import(
      "../components/OverviewPostCard"
    );
    const html = renderToStaticMarkup(
      React.createElement(OverviewPostCard, {
        id: 1,
        title: "Server markdown",
        updatedAt: new Date("2026-08-31T00:00:00.000Z"),
        createdAt: new Date("2026-08-30T00:00:00.000Z"),
        catelog: "Performance",
        content: "**server rendered**",
        private: false,
        top: 0,
        enableComment: "true",
        openArticleLinksInNewWindow: false,
        showEditButton: false,
        showExpirationReminder: false,
        codeMaxLines: 12,
      }),
    );

    expect(html).toContain('data-rendered-markdown="true"');
    expect(html).toContain("<strong>server rendered</strong>");
    expect(html).not.toContain('data-client-markdown="true"');
  });

  it("uses initial html for server moments and client markdown only for dynamic moments", async () => {
    const { default: MomentPage } = await import("../page-components/moment");
    const html = renderToStaticMarkup(
      React.createElement(MomentPage as any, {
        initialMoments: [
          {
            id: 1,
            content: "**initial**",
            initialRenderedHtml: "<p><strong>initial</strong></p>",
            createdAt: "2026-08-31T00:00:00.000Z",
            updatedAt: "2026-08-31T00:00:00.000Z",
          },
          {
            id: 2,
            content: "**dynamic**",
            createdAt: "2026-08-30T00:00:00.000Z",
            updatedAt: "2026-08-30T00:00:00.000Z",
          },
        ],
        initialTotal: 2,
        authorCardProps: {},
        siteName: "VanBlog",
        articleWidthMode: "standard",
      }),
    );

    expect(html).toContain("<strong>initial</strong>");
    expect(html).toContain('data-client-markdown="true"');
    expect(html).toContain("**dynamic**");
  });

  it("pre-renders initial moment markdown in the active server route", async () => {
    getMomentPageProps.mockResolvedValue({
      initialMoments: [
        {
          id: 1,
          content: "**initial route moment**",
          createdAt: "2026-08-31T00:00:00.000Z",
          updatedAt: "2026-08-31T00:00:00.000Z",
        },
      ],
      initialTotal: 1,
      codeMaxLines: 18,
    });

    const route = await import("../app/moment/page");
    const element = await route.default();
    const moment = (element as React.ReactElement<any>).props.initialMoments[0];

    expect(moment.initialRenderedHtml).toContain(
      "<strong>initial route moment</strong>",
    );
  });

  it("resolves the server-rendered link requirement origin without rerendering markdown", async () => {
    const { default: LinkPage } = await import("../page-components/link");
    const html = renderToStaticMarkup(
      React.createElement(LinkPage as any, {
        layoutProps: {
          siteName: "VanBlog",
          articleWidthMode: "standard",
          enableComment: "false",
        },
        authorCardProps: {},
        links: [],
        siteUrl: "https://blog.example.com",
        initialRenderedHtml:
          '<p>VANBLOG_SITE_ORIGIN <a href="https://vanblog-site-origin.invalid">site</a></p>',
      }),
    );

    expect(html).toContain("https://blog.example.com");
    expect(html).not.toContain("vanblog-site-origin.invalid");
    expect(html).not.toContain('data-client-markdown="true"');
  });

  it("keeps heavy client markdown behind the moment dynamic fallback", () => {
    const overview = readFileSync(
      new URL("../components/OverviewPostCard/index.tsx", import.meta.url),
      "utf8",
    );
    const moment = readFileSync(
      new URL("../page-components/moment.tsx", import.meta.url),
      "utf8",
    );
    const link = readFileSync(
      new URL("../page-components/link.tsx", import.meta.url),
      "utf8",
    );

    expect(overview).not.toMatch(/import Markdown from/);
    expect(link).not.toMatch(/import Markdown from/);
    expect(moment).not.toMatch(/import Markdown from/);
    expect(moment).toContain("dynamic(() => import('../components/Markdown')");
  });
});
