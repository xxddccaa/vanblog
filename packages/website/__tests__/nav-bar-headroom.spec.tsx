// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const headroomInstances: Array<{
  init: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  pin: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("headroom.js", () => ({
  default: class MockHeadroom {
    init = vi.fn();
    destroy = vi.fn();
    pin = vi.fn();

    constructor() {
      headroomInstances.push(this);
    }
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("../components/ThemeButton", () => ({
  default: () => React.createElement("div", null, "theme"),
}));

vi.mock("../components/KeyCard", () => ({
  default: () => React.createElement("div", null, "key"),
}));

vi.mock("../components/AdminButton", () => ({
  default: () => React.createElement("div", null, "admin"),
}));

vi.mock("../components/RssButton", () => ({
  default: () => React.createElement("div", null, "rss"),
}));

vi.mock("../components/NavBar/item", () => ({
  default: () => React.createElement("li", null, "menu"),
}));

const createProps = (overrides: Record<string, unknown> = {}) => ({
  logo: "/logo.svg",
  logoDark: "",
  categories: [],
  setOpen: vi.fn(),
  isOpen: false,
  siteName: "VanBlog",
  menus: [] as any[],
  showSubMenu: "false" as const,
  showAdminButton: "false" as const,
  showFriends: "false" as const,
  showRSS: "false" as const,
  headerLeftContent: "siteName" as const,
  defaultTheme: "dark" as const,
  subMenuOffset: 0,
  openArticleLinksInNewWindow: false,
  ...overrides,
});

describe("NavBar Headroom lifecycle", () => {
  afterEach(() => {
    headroomInstances.length = 0;
    document.body.innerHTML = "";
  });

  it("keeps one instance across menu state changes and destroys it on unmount", async () => {
    const { default: NavBar } = await import("../components/NavBar");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const setOpen = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(NavBar, createProps({ setOpen, isOpen: false })),
      );
    });

    expect(headroomInstances).toHaveLength(1);
    expect(headroomInstances[0].init).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        React.createElement(NavBar, createProps({ setOpen, isOpen: true })),
      );
    });
    await act(async () => {
      root.render(
        React.createElement(NavBar, createProps({ setOpen, isOpen: false })),
      );
    });

    expect(headroomInstances).toHaveLength(1);
    expect(headroomInstances[0].destroy).not.toHaveBeenCalled();

    const mobileToggle = Array.from(
      container.querySelectorAll<HTMLDivElement>("div"),
    ).find(
      (element) =>
        element.classList.contains("cursor-pointer") &&
        element.classList.contains("block") &&
        element.classList.contains("md:hidden"),
    );

    expect(mobileToggle).toBeTruthy();
    await act(async () => {
      mobileToggle?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(headroomInstances[0].pin).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(true);

    await act(async () => {
      root.unmount();
    });

    expect(headroomInstances[0].destroy).toHaveBeenCalledTimes(1);
  });
});
