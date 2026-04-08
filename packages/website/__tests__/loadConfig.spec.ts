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
});
