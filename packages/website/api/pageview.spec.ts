import { afterEach, describe, expect, it, vi } from "vitest";
import { getPageview, recordPageview } from "./pageview";

const createStorage = (initial?: Record<string, string>) => {
  const store = new Map(Object.entries(initial || {}));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

describe("pageview api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads the public pageview aggregate via the dedicated GET endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        statusCode: 200,
        data: {
          viewer: 12,
          visited: 8,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPageview("/post/edge-cache")).resolves.toEqual({
      viewer: 12,
      visited: 8,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/public/viewer", { method: "GET" });
  });

  it("records pageviews with sendBeacon when the browser supports it", async () => {
    const localStorage = createStorage();
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();

    vi.stubGlobal("window", { localStorage } as any);
    vi.stubGlobal("navigator", { sendBeacon } as any);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Blob", class MockBlob {
      parts: unknown[];
      options: unknown;
      constructor(parts: unknown[], options: unknown) {
        this.parts = parts;
        this.options = options;
      }
    } as any);

    await recordPageview("/post/edge-cache");

    expect(localStorage.setItem).toHaveBeenCalledWith("visited", "true");
    expect(localStorage.setItem).toHaveBeenCalledWith("visited-/post/edge-cache", "true");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(
      "/api/public/viewer?isNew=true&isNewByPath=true",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to keepalive fetch when sendBeacon is unavailable or rejected", async () => {
    const localStorage = createStorage({
      visited: "true",
    });
    const fetchMock = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("window", { localStorage } as any);
    vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(false) } as any);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Blob", class MockBlob {
      parts: unknown[];
      options: unknown;
      constructor(parts: unknown[], options: unknown) {
        this.parts = parts;
        this.options = options;
      }
    } as any);

    await recordPageview("/post/edge-cache");

    expect(fetchMock).toHaveBeenCalledWith("/api/public/viewer?isNew=false&isNewByPath=true", {
      method: "POST",
      keepalive: true,
    });
  });

  it("does not report repeated visits as new when the same pathname was already recorded", async () => {
    const localStorage = createStorage({
      visited: "true",
      "visited-/post/edge-cache": "true",
    });
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();

    vi.stubGlobal("window", { localStorage } as any);
    vi.stubGlobal("navigator", { sendBeacon } as any);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Blob", class MockBlob {
      parts: unknown[];
      options: unknown;
      constructor(parts: unknown[], options: unknown) {
        this.parts = parts;
        this.options = options;
      }
    } as any);

    await recordPageview("/post/edge-cache");

    expect(sendBeacon).toHaveBeenCalledWith(
      "/api/public/viewer?isNew=false&isNewByPath=false",
      expect.any(Blob),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
