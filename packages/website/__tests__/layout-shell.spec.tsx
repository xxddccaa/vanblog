import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/",
  }),
}));

vi.mock("../components/BackToTop", () => ({
  default: () => React.createElement("div", null, "back-to-top"),
}));

vi.mock("../components/NavBar", () => ({
  default: () => React.createElement("div", null, "nav-bar"),
}));

vi.mock("../components/MusicPlayer", () => ({
  default: () => React.createElement("div", null, "music-player"),
}));

vi.mock("../components/BaiduAnalysis", () => ({
  default: () => React.createElement("div", null, "baidu-analysis"),
}));

vi.mock("../components/gaAnalysis", () => ({
  default: () => React.createElement("div", null, "ga-analysis"),
}));

vi.mock("../components/CustomLayout", () => ({
  default: () => React.createElement("div", null, "custom-layout"),
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => React.createElement("div", null, "toaster"),
}));

vi.mock("../components/NavBarMobile", () => ({
  default: () => React.createElement("div", null, "nav-mobile"),
}));

vi.mock("../components/LayoutBody", () => ({
  default: ({ children, sideBar }: { children: React.ReactNode; sideBar: React.ReactNode }) =>
    React.createElement(
      "div",
      { className: "layout-body" },
      children,
      sideBar,
    ),
}));

vi.mock("../components/ImageBox", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt: alt || "mock-image" }),
}));

vi.mock("../components/RunningTime", () => ({
  default: () => React.createElement("div", null, "running-time"),
}));

describe("layout cache shell", () => {
  it("keeps footer viewer counters at the default SSR placeholder values", async () => {
    const { default: Layout } = await import("../components/Layout");

    const html = renderToStaticMarkup(
      React.createElement(
        Layout,
        {
          title: "VanBlog",
          sideBar: React.createElement("aside", null, "side-bar"),
          option: {
            description: "Cache-first blog",
            ipcNumber: "ICP 12345678",
            since: "2020-01-01T00:00:00.000Z",
            ipcHref: "https://beian.miit.gov.cn",
            gaBeianNumber: "GA 12345678",
            gaBeianUrl: "https://beian.example.com",
            gaBeianLogoUrl: "/logo.png",
            copyrightAggreement: "CC BY-NC-SA 4.0",
            logo: "/logo.svg",
            categories: [],
            favicon: "/favicon.ico",
            siteName: "VanBlog",
            siteDesc: "Cache-first blog",
            baiduAnalysisID: "",
            gaAnalysisID: "",
            logoDark: "/logo-dark.svg",
            version: "1.0.0",
            menus: [],
            showSubMenu: "false",
            showAdminButton: "false",
            showFriends: "false",
            headerLeftContent: "siteName",
            enableComment: "true",
            defaultTheme: "auto",
            enableCustomizing: "false",
            showDonateButton: "false",
            showCopyRight: "true",
            showRSS: "false",
            showExpirationReminder: "true",
            openArticleLinksInNewWindow: "false",
            showEditButton: "false",
            subMenuOffset: 0,
            homePageSize: 5,
            privateSite: "false",
            codeMaxLines: 12,
            showRunningTime: "true",
            backgroundImage: "",
            backgroundImageDark: "",
            markdownLightThemeUrl: "",
            markdownDarkThemeUrl: "",
          },
        } as any,
        React.createElement("main", null, "page-shell"),
      ),
    );

    expect(html).toContain("page-shell");
    expect(html).toContain("footer-viewer");
    expect(html).toContain(">0</span>");
    expect(html).not.toContain("999999");
    expect(html).not.toContain("888888");
  });
});
