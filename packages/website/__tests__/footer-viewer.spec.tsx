import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Footer from "../components/Footer";

vi.mock("../components/ImageBox", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt: alt || "mock-image" }),
}));

vi.mock("../components/RunningTime", () => ({
  default: ({ since }: { since: string }) => React.createElement("div", null, `running-${since}`),
}));

const renderFooter = () =>
  renderToStaticMarkup(
    React.createElement(Footer, {
      ipcHref: "https://beian.miit.gov.cn",
      ipcNumber: "ICP 12345678",
      since: "2020-01-01T00:00:00.000Z",
      version: "1.0.0",
      gaBeianLogoUrl: "/logo.png",
      gaBeianNumber: "GA 12345678",
      gaBeianUrl: "https://beian.example.com",
      showRunningTime: "true",
    }),
  );

describe("footer viewer cache shell", () => {
  it("server-renders footer viewer with only the default placeholder counters", () => {
    const html = renderFooter();

    expect(html).toContain("footer-viewer");
    expect(html).toContain(">0</span>");
    expect(html).not.toContain("999999");
    expect(html).not.toContain("888888");
  });
});
