import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const menuSpy = vi.fn(
  ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { className: "menu-mock" }, children),
);

vi.mock("react-burger-menu", () => ({
  slide: (props: any) => menuSpy(props),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

describe("NavBarMobile", () => {
  it("passes explicit fallback props required by react-burger-menu", async () => {
    const { default: NavBarMobile } = await import("../components/NavBarMobile");

    const html = renderToStaticMarkup(
      React.createElement(NavBarMobile, {
        isOpen: false,
        setIsOpen: vi.fn(),
        showAdminButton: "false",
        showFriends: "false",
        menus: [{ id: 1, name: "首页", value: "/", level: 0 }],
      }),
    );

    expect(html).toContain("menu-mock");
    expect(menuSpy).toHaveBeenCalledTimes(1);
    expect(menuSpy.mock.calls[0][0]).toMatchObject({
      styles: {},
      itemListElement: "nav",
      customCrossIcon: false,
      customBurgerIcon: false,
    });
  });
});
