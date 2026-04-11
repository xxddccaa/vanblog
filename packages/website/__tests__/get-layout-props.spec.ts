import { describe, expect, it } from "vitest";

import { getLayoutProps } from "../utils/getLayoutProps";

describe("getLayoutProps", () => {
  it("normalizes the public moment menu label to 动态", () => {
    const layoutProps = getLayoutProps({
      version: "1.2.0",
      tags: [],
      totalArticles: 0,
      totalWordCount: 0,
      menus: [
        { id: 1, name: "首页", value: "/", level: 0 },
        { id: 5, name: "个人动态", value: "/moment", level: 0 },
      ],
      meta: {
        categories: [],
        socials: [],
        siteInfo: {
          favicon: "/favicon.ico",
          siteName: "VanBlog",
          siteDesc: "Cache-first blog",
        },
      },
    } as any);

    expect(layoutProps.menus.find((item) => item.value === "/moment")?.name).toBe("动态");
  });
});
