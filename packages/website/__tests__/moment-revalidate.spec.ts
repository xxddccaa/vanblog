import { describe, expect, it, vi } from "vitest";

vi.mock("../page-components/moment", () => ({
  default: vi.fn(),
}));

vi.mock("../utils/getPageProps", () => ({
  getMomentPageProps: vi.fn(),
}));

vi.mock("../utils/renderMarkdown", () => ({
  renderMarkdownToHtml: vi.fn(),
}));

describe("moment route revalidation", () => {
  it("uses the shared 60 second public content window", async () => {
    const route = await import("../app/moment/page");

    expect(route.revalidate).toBe(60);
  });
});
