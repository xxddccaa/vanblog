// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MARKDOWN_THEME_HOTFIX_URL,
  withMarkdownThemeAssetVersion,
} from "../utils/markdownTheme";
import { syncMarkdownThemeResourceState } from "../components/Layout/MarkdownThemeResources";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/head", () => ({
  default: () => null,
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

const createLayoutOption = (overrides: Record<string, unknown> = {}) => ({
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
  favicon: "/favicon.ico",
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
  backgroundImage: "",
  backgroundImageDark: "",
  frontCardBackgroundColor: "#f5fbff",
  frontCardBackgroundColorDark: "#15314d",
  markdownLightThemeUrl: "/markdown-themes/light.css",
  markdownDarkThemeUrl: "/markdown-themes/dark.css",
  ...overrides,
});

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
            includeMarkdownThemeHead: true,
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
      document.head
        .querySelector("link[data-vanblog-theme-link='true'][data-theme-for='light']")
        ?.getAttribute("href"),
    ).toBe(withMarkdownThemeAssetVersion("/markdown-themes/light.css"));
    expect(
      document.head
        .querySelector("link[data-vanblog-theme-link='true'][data-theme-for='dark']")
        ?.getAttribute("href"),
    ).toBe(withMarkdownThemeAssetVersion("/markdown-themes/dark.css"));
    expect(
      document.head.querySelector("link[data-vanblog-theme-hotfix='true']")?.getAttribute("href"),
    ).toBe(withMarkdownThemeAssetVersion(MARKDOWN_THEME_HOTFIX_URL));
    expect(
      document.head
        .querySelector("link[data-vanblog-theme-link='true'][data-theme-for='light']")
        ?.getAttribute("data-precedence"),
    ).toBe("vanblog-markdown-theme");
    expect(
      document.head
        .querySelector("link[data-vanblog-theme-link='true'][data-theme-for='dark']")
        ?.getAttribute("data-precedence"),
    ).toBe("vanblog-markdown-theme");
    expect(
      document.head
        .querySelector("link[data-vanblog-theme-hotfix='true']")
        ?.getAttribute("data-precedence"),
    ).toBe("vanblog-markdown-hotfix");
    const managedResources = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>(
        "link[data-vanblog-theme-link='true'], link[data-vanblog-theme-hotfix='true']",
      ),
    );
    expect(
      managedResources.findIndex(
        (link) => link.dataset.themeFor === "dark",
      ),
    ).toBeLessThan(
      managedResources.findIndex(
        (link) => link.dataset.vanblogThemeHotfix === "true",
      ),
    );
    expect(
      document.querySelector("[data-vb-markdown-light-theme-id='light'][data-vb-markdown-dark-theme-id='dark']"),
    ).toBeTruthy();
    expect(
      (
        document.querySelector(
          "[data-vb-front-surface-scope='true']",
        ) as HTMLElement | null
      )?.style.getPropertyValue("--vb-front-card-bg-light"),
    ).toBe("#f5fbff");
    expect(
      (
        document.querySelector(
          "[data-vb-front-surface-scope='true']",
        ) as HTMLElement | null
      )?.style.getPropertyValue("--vb-front-card-bg-dark"),
    ).toBe("#15314d");
    expect(document.documentElement.style.getPropertyValue("--vb-front-page-bg-dark")).toBe(
      "#13273c",
    );
    expect(document.documentElement.style.backgroundColor).toBe("rgb(19, 39, 60)");

    await act(async () => {
      root.unmount();
    });
    expect(
      Array.from(
        document.head.querySelectorAll<HTMLLinkElement>(
          "link[data-vanblog-theme-link='true'], link[data-vanblog-theme-hotfix='true']",
        ),
      ).every((link) => link.disabled),
    ).toBe(true);
  });

  it("does not inject markdown theme stylesheets for non-rich pages", async () => {
    const { default: Layout } = await import("../components/Layout");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          Layout,
          {
            title: "Home",
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
              favicon: "/favicon.ico",
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
              backgroundImage: "",
              backgroundImageDark: "",
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

    expect(document.head.querySelector("link[data-vanblog-theme-link='true']")).toBeNull();
    expect(document.head.querySelector("link[data-vanblog-theme-hotfix='true']")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("enables only the current retained theme resources", () => {
    const appendStylesheet = (
      href: string,
      attributes: Record<string, string>,
    ) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = withMarkdownThemeAssetVersion(href);
      Object.entries(attributes).forEach(([name, value]) =>
        link.setAttribute(name, value),
      );
      document.head.appendChild(link);
      return link;
    };
    const lightA = appendStylesheet("/markdown-themes/light-a.css", {
      "data-theme-for": "light",
      "data-vanblog-theme-link": "true",
    });
    const darkA = appendStylesheet("/markdown-themes/dark-a.css", {
      "data-theme-for": "dark",
      "data-vanblog-theme-link": "true",
    });
    const lightB = appendStylesheet("/markdown-themes/light-b.css", {
      "data-theme-for": "light",
      "data-vanblog-theme-link": "true",
    });
    const darkB = appendStylesheet("/markdown-themes/dark-b.css", {
      "data-theme-for": "dark",
      "data-vanblog-theme-link": "true",
    });
    const hotfix = appendStylesheet(MARKDOWN_THEME_HOTFIX_URL, {
      "data-vanblog-theme-hotfix": "true",
    });

    syncMarkdownThemeResourceState(document, {
      enabled: true,
      lightThemeUrl: "/markdown-themes/light-b.css",
      darkThemeUrl: "/markdown-themes/dark-b.css",
    });
    expect(lightA.disabled).toBe(true);
    expect(darkA.disabled).toBe(true);
    expect(lightB.disabled).toBe(false);
    expect(darkB.disabled).toBe(false);
    expect(hotfix.disabled).toBe(false);

    syncMarkdownThemeResourceState(document, {
      enabled: false,
      lightThemeUrl: "/markdown-themes/light-b.css",
      darkThemeUrl: "/markdown-themes/dark-b.css",
    });
    expect(lightA.disabled).toBe(true);
    expect(darkA.disabled).toBe(true);
    expect(lightB.disabled).toBe(true);
    expect(darkB.disabled).toBe(true);
    expect(hotfix.disabled).toBe(true);

    syncMarkdownThemeResourceState(document, {
      enabled: true,
      lightThemeUrl: "/markdown-themes/light-a.css",
      darkThemeUrl: "/markdown-themes/dark-a.css",
    });
    expect(lightA.disabled).toBe(false);
    expect(darkA.disabled).toBe(false);
    expect(lightB.disabled).toBe(true);
    expect(darkB.disabled).toBe(true);
    expect(hotfix.disabled).toBe(false);
  });

  it("disables retained resources across rich/plain navigation and A-B-A theme changes", async () => {
    const { default: Layout } = await import("../components/Layout");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const lightA = "/markdown-themes/light-a.css";
    const darkA = "/markdown-themes/dark-a.css";
    const lightB = "/markdown-themes/light-b.css";
    const darkB = "/markdown-themes/dark-b.css";

    const renderLayout = async ({
      includeMarkdownThemeHead,
      lightThemeUrl,
      darkThemeUrl,
    }: {
      includeMarkdownThemeHead?: boolean;
      lightThemeUrl: string;
      darkThemeUrl: string;
    }) => {
      await act(async () => {
        root.render(
          React.createElement(
            Layout,
            {
              title: "Dong",
              sideBar: React.createElement("aside", null, "side-bar"),
              includeMarkdownThemeHead,
              option: createLayoutOption({
                markdownLightThemeUrl: lightThemeUrl,
                markdownDarkThemeUrl: darkThemeUrl,
              }),
            } as any,
            React.createElement("main", null, "page-shell"),
          ),
        );
      });
    };

    const getThemeLink = (href: string) =>
      document.head.querySelector(
        `link[href='${withMarkdownThemeAssetVersion(href)}']`,
      ) as HTMLLinkElement | null;
    await renderLayout({
      includeMarkdownThemeHead: true,
      lightThemeUrl: lightA,
      darkThemeUrl: darkA,
    });
    expect(getThemeLink(lightA)?.disabled).toBe(false);
    expect(getThemeLink(darkA)?.disabled).toBe(false);

    await renderLayout({
      lightThemeUrl: lightA,
      darkThemeUrl: darkA,
    });
    expect(getThemeLink(lightA)?.disabled).toBe(true);
    expect(getThemeLink(darkA)?.disabled).toBe(true);

    await renderLayout({
      includeMarkdownThemeHead: true,
      lightThemeUrl: lightB,
      darkThemeUrl: darkB,
    });
    expect(getThemeLink(lightA)?.disabled).toBe(true);
    expect(getThemeLink(darkA)?.disabled).toBe(true);
    expect(getThemeLink(lightB)?.disabled).toBe(false);
    expect(getThemeLink(darkB)?.disabled).toBe(false);

    await renderLayout({
      includeMarkdownThemeHead: true,
      lightThemeUrl: lightA,
      darkThemeUrl: darkA,
    });
    expect(getThemeLink(lightA)?.disabled).toBe(false);
    expect(getThemeLink(darkA)?.disabled).toBe(false);
    expect(getThemeLink(lightB)?.disabled).toBe(true);
    expect(getThemeLink(darkB)?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });
});
