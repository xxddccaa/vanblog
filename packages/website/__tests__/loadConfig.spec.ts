import { afterEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  vi.resetModules();
  return await import("../utils/loadConfig");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("loadConfig", () => {
  it("uses the internal service URL for server-side production rendering", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete (globalThis as any).window;

    const { getServerBaseUrl, config } = await loadModule();

    expect(getServerBaseUrl()).toBe("http://server:3000/");
    expect(config.baseUrl).toBe("http://server:3000/");
  });

  it("uses a relative base URL in the browser when no public base URL is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", {
      location: {
        origin: "http://127.0.0.1:3001",
      },
    });

    const { config } = await loadModule();

    expect(config.baseUrl).toBe("/");
  });

  it("uses NEXT_PUBLIC_BASE_URL in the browser when it is provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://blog.example.com");
    vi.stubGlobal("window", {
      location: {
        origin: "http://127.0.0.1:3001",
      },
    });

    const { config } = await loadModule();

    expect(config.baseUrl).toBe("https://blog.example.com/");
  });

  it("uses persistent server fetch caching for on-demand ISR by default", async () => {
    vi.stubEnv("VAN_BLOG_REVALIDATE", "");
    delete (globalThis as any).window;

    const { getServerFetchOptions, revalidate } = await loadModule();

    expect(getServerFetchOptions()).toEqual({
      cache: "force-cache",
    });
    expect(revalidate).toEqual({});
  });

  it("keeps explicit fetch cache options in on-demand mode", async () => {
    vi.stubEnv("VAN_BLOG_REVALIDATE", "false");
    delete (globalThis as any).window;

    const { getServerFetchOptions } = await loadModule();

    expect(getServerFetchOptions({ cache: "no-store" })).toEqual({
      cache: "no-store",
    });
    expect(getServerFetchOptions({ next: { revalidate: 15 } })).toEqual({
      next: { revalidate: 15 },
    });
  });

  it("uses a 60 second default for delay ISR", async () => {
    vi.stubEnv("VAN_BLOG_REVALIDATE", "true");
    vi.stubEnv("VAN_BLOG_REVALIDATE_TIME", "");
    delete (globalThis as any).window;

    const { getServerFetchOptions, revalidate } = await loadModule();

    expect(getServerFetchOptions()).toEqual({
      next: {
        revalidate: 60,
      },
    });
    expect(revalidate).toEqual({
      revalidate: 60,
    });
  });

  it("keeps explicit fetch cache options in delay mode", async () => {
    vi.stubEnv("VAN_BLOG_REVALIDATE", "true");
    vi.stubEnv("VAN_BLOG_REVALIDATE_TIME", "60");
    delete (globalThis as any).window;

    const { getServerFetchOptions } = await loadModule();

    expect(getServerFetchOptions({ cache: "no-store" })).toEqual({
      cache: "no-store",
    });
    expect(getServerFetchOptions({ next: { revalidate: 15 } })).toEqual({
      next: { revalidate: 15 },
    });
    expect(getServerFetchOptions({ next: { revalidate: 0 } })).toEqual({
      next: { revalidate: 0 },
    });
  });

  it("normalizes configured delay ISR values", async () => {
    vi.stubEnv("VAN_BLOG_REVALIDATE", "true");
    vi.stubEnv("VAN_BLOG_REVALIDATE_TIME", "120");
    delete (globalThis as any).window;

    const configured = await loadModule();
    expect(configured.getServerFetchOptions()).toEqual({
      next: {
        revalidate: 120,
      },
    });

    vi.resetModules();
    vi.stubEnv("VAN_BLOG_REVALIDATE_TIME", "invalid");
    const invalid = await import("../utils/loadConfig");
    expect(invalid.getServerFetchOptions()).toEqual({
      next: {
        revalidate: 60,
      },
    });
  });

  it("does not inject server cache metadata in the browser", async () => {
    vi.stubEnv("VAN_BLOG_REVALIDATE", "false");
    vi.stubGlobal("window", {
      location: {
        origin: "http://127.0.0.1:3001",
      },
    });

    const { getServerFetchOptions } = await loadModule();

    expect(getServerFetchOptions({ headers: { accept: "application/json" } })).toEqual({
      headers: { accept: "application/json" },
    });
  });
});
