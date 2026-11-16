import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

vi.mock("../utils/revalidateAuth", () => ({
  isRevalidateRequestAuthorized: () => true,
  isRevalidateTokenConfigured: () => true,
}));

const createRequest = (query: string) => {
  const url = new URL(`http://website:3001/api/revalidate?${query}`);
  return {
    headers: new Headers({ "x-vanblog-isr-token": "token" }),
    nextUrl: url,
  } as any;
};

describe("revalidate route", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
  });

  it("revalidates a single path by default", async () => {
    const { GET } = await import("../app/api/revalidate/route");

    const response = await GET(createRequest("path=/post/1"));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/post/1");
  });

  it("revalidates a whole layout when asked", async () => {
    const { GET } = await import("../app/api/revalidate/route");

    await GET(createRequest("path=/&type=layout"));

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("ignores unknown revalidation types", async () => {
    const { GET } = await import("../app/api/revalidate/route");

    await GET(createRequest("path=/&type=everything"));

    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
