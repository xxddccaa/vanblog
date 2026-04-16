// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { className: "layout-body" }, children),
}));

vi.mock("../components/ImageBox", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt: alt || "mock-image" }),
}));

vi.mock("../components/RunningTime", () => ({
  default: () => React.createElement("div", null, "running-time"),
}));

describe("layout head sync", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--bg-image");
    document.documentElement.style.removeProperty("--bg-image-dark");
  });

  it("syncs the favicon, title, description, and background CSS variables after hydration", async () => {
    const { default: Layout } = await import("../components/Layout");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          Layout,
          {
            title: "Dong",
            sideBar: React.createElement("aside", null, "side-bar"),
            option: {
              description: "Dong blog",
              ipcNumber: "",
              since: "2020-01-01T00:00:00.000Z",
              ipcHref: "",
              gaBeianNumber: "",
              gaBeianUrl: "",
              gaBeianLogoUrl: "",
              copyrightAggreement: "CC BY-NC-SA 4.0",
              logo: "/logo.svg",
              categories: [],
              favicon: "https://www.dong-blog.fun/static/img/favicon.webp",
              siteName: "Dong",
              siteDesc: "Dong blog",
              baiduAnalysisID: "",
              gaAnalysisID: "",
              logoDark: "/logo-dark.svg",
              version: "1.0.0",
              menus: [],
              showSubMenu: "false",
              showAdminButton: "false",
              showFriends: "false",
              headerLeftContent: "siteName",
              enableComment: "false",
              defaultTheme: "dark",
              enableCustomizing: "false",
              showDonateButton: "false",
              showCopyRight: "true",
              showRSS: "false",
              showExpirationReminder: "false",
              openArticleLinksInNewWindow: "false",
              showEditButton: "false",
              subMenuOffset: 0,
              homePageSize: 5,
              privateSite: "false",
              codeMaxLines: 12,
              showRunningTime: "false",
              backgroundImage: "https://www.dong-blog.fun/static/img/bg.webp",
              backgroundImageDark: "https://www.dong-blog.fun/static/img/bg-dark.webp",
              frontCardBackgroundColor: "#f5fbff",
              frontCardBackgroundColorDark: "#15314d",
              markdownLightThemeUrl: "/markdown-themes/light.css",
              markdownDarkThemeUrl: "/markdown-themes/dark.css",
            },
          } as any,
          React.createElement("main", null, "page-shell"),
        ),
      );
    });

    expect(document.title).toBe("Dong");
    expect(
      document.head.querySelector("link[rel='icon'][data-vanblog-managed='true']")?.getAttribute("href"),
    ).toBe("https://www.dong-blog.fun/static/img/favicon.webp");
    expect(
      document.head.querySelector("meta[name='description'][data-vanblog-managed='true']")?.getAttribute("content"),
    ).toBe("Dong blog");
    expect(document.documentElement.style.getPropertyValue("--bg-image")).toContain("bg.webp");
    expect(document.documentElement.style.getPropertyValue("--bg-image-dark")).toContain(
      "bg-dark.webp",
    );
    expect(
      document.head.querySelector("link[data-vanblog-theme-link][data-theme-for='light']")?.getAttribute("href"),
    ).toBe("/markdown-themes/light.css");
    expect(
      document.head.querySelector("link[data-vanblog-theme-link][data-theme-for='dark']")?.getAttribute("href"),
    ).toBe("/markdown-themes/dark.css");
    expect(
      document.head.querySelector("link[data-vanblog-theme-hotfix='true']")?.getAttribute("href"),
    ).toBe("/markdown-themes/vanblog-theme-hotfix.css");
    expect(
      document.querySelector("[data-vb-markdown-light-theme-id='light'][data-vb-markdown-dark-theme-id='dark']"),
    ).toBeTruthy();
    expect(
      document
        .querySelector("[data-vb-front-surface-scope='true']")
        ?.style.getPropertyValue("--vb-front-card-bg-light"),
    ).toBe("#f5fbff");
    expect(
      document
        .querySelector("[data-vb-front-surface-scope='true']")
        ?.style.getPropertyValue("--vb-front-card-bg-dark"),
    ).toBe("#15314d");
    expect(document.documentElement.style.getPropertyValue("--vb-front-page-bg-dark")).toBe(
      "#153350",
    );
    expect(document.documentElement.style.backgroundColor).toBe("rgb(21, 51, 80)");

    await act(async () => {
      root.unmount();
    });
  });
});
