import { describe, expect, it, vi } from "vitest";
import { createReloadViewer, setupPageviewLifecycle } from "../utils/pageviewLifecycle";

describe("pageview lifecycle", () => {
  it("reloads viewer state through the read API after recording a pageview", async () => {
    const calls: string[] = [];
    const setGlobalState = vi.fn();
    const reloadViewer = createReloadViewer({
      getWindow: () =>
        ({
          location: { pathname: "/post/stable-shell" },
          localStorage: {
            getItem: vi.fn().mockReturnValue(null),
          },
        }) as any,
      recordPageview: vi.fn(async (pathname: string) => {
        calls.push(`record:${pathname}`);
      }),
      getPageview: vi.fn(async (pathname: string) => {
        calls.push(`read:${pathname}`);
        return { viewer: 12, visited: 8 };
      }),
      setGlobalState,
    });

    await reloadViewer();

    expect(calls).toEqual(["record:/post/stable-shell", "read:/post/stable-shell"]);
    expect(setGlobalState).toHaveBeenCalledWith({ viewer: 12, visited: 8 });
  });

  it("does not block the read request on the fire-and-forget pageview write", async () => {
    const calls: string[] = [];
    const setGlobalState = vi.fn();
    const reloadViewer = createReloadViewer({
      getWindow: () =>
        ({
          location: { pathname: "/post/stable-shell" },
          localStorage: {
            getItem: vi.fn().mockReturnValue(null),
          },
        }) as any,
      recordPageview: vi.fn((pathname: string) => {
        calls.push(`record:${pathname}`);
        return new Promise<void>(() => undefined);
      }),
      getPageview: vi.fn(async (pathname: string) => {
        calls.push(`read:${pathname}`);
        return { viewer: 12, visited: 8 };
      }),
      setGlobalState,
    });

    await reloadViewer();

    expect(calls).toEqual(["record:/post/stable-shell", "read:/post/stable-shell"]);
    expect(setGlobalState).toHaveBeenCalledWith({ viewer: 12, visited: 8 });
  });

  it("skips the write call when noViewer is set locally", async () => {
    const recordPageview = vi.fn();
    const setGlobalState = vi.fn();
    const reloadViewer = createReloadViewer({
      getWindow: () =>
        ({
          location: { pathname: "/post/stable-shell" },
          localStorage: {
            getItem: vi.fn((key: string) => (key === "noViewer" ? "1" : null)),
          },
        }) as any,
      recordPageview,
      getPageview: vi.fn(async () => ({ viewer: 3, visited: 2 })),
      setGlobalState,
    });

    await reloadViewer();

    expect(recordPageview).not.toHaveBeenCalled();
    expect(setGlobalState).toHaveBeenCalledWith({ viewer: 3, visited: 2 });
  });

  it("does nothing when browser pathname is unavailable", async () => {
    const recordPageview = vi.fn();
    const getPageview = vi.fn();
    const setGlobalState = vi.fn();
    const reloadViewer = createReloadViewer({
      getWindow: () => undefined,
      recordPageview,
      getPageview,
      setGlobalState,
    });

    await reloadViewer();

    expect(recordPageview).not.toHaveBeenCalled();
    expect(getPageview).not.toHaveBeenCalled();
    expect(setGlobalState).not.toHaveBeenCalled();
  });

  it("runs once on init and subscribes route change reloads", async () => {
    const handlers = new Map<string, () => void>();
    const routerEvents = {
      on: vi.fn((event: string, handler: () => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn((event: string, handler: () => void) => {
        if (handlers.get(event) === handler) {
          handlers.delete(event);
        }
      }),
    };
    const reloadViewer = vi.fn().mockResolvedValue(undefined);

    const cleanup = setupPageviewLifecycle({
      current: { hasInit: false },
      routerEvents,
      reloadViewer,
    });

    expect(reloadViewer).toHaveBeenCalledTimes(1);
    expect(routerEvents.on).toHaveBeenCalledWith("routeChangeComplete", expect.any(Function));

    handlers.get("routeChangeComplete")?.();
    expect(reloadViewer).toHaveBeenCalledTimes(2);

    cleanup();
    expect(routerEvents.off).toHaveBeenCalledWith("routeChangeComplete", expect.any(Function));
  });

  it("does not force a second init reload when the ref is already primed", () => {
    const routerEvents = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const reloadViewer = vi.fn().mockResolvedValue(undefined);

    setupPageviewLifecycle({
      current: { hasInit: true },
      routerEvents,
      reloadViewer,
    });

    expect(reloadViewer).not.toHaveBeenCalled();
    expect(routerEvents.on).toHaveBeenCalledWith("routeChangeComplete", expect.any(Function));
  });
});
