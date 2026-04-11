import type { GlobalState } from "./globalContext";
import type { PageViewData } from "../api/pageview";

interface WindowLike {
  location?: {
    pathname?: string;
  };
  localStorage?: {
    getItem: (key: string) => string | null;
  };
}

interface RouterEvents {
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
}

interface CreateReloadViewerOptions {
  getWindow: () => WindowLike | undefined;
  getPageview: (pathname: string) => Promise<PageViewData>;
  recordPageview: (pathname: string) => Promise<void>;
  setGlobalState: (state: GlobalState) => void;
}

interface SetupPageviewLifecycleOptions {
  current: {
    hasInit: boolean;
  };
  routerEvents: RouterEvents;
  reloadViewer: () => Promise<void>;
}

export const createReloadViewer = ({
  getWindow,
  getPageview,
  recordPageview,
  setGlobalState,
}: CreateReloadViewerOptions) => {
  return async () => {
    const currentWindow = getWindow();
    const pathname = currentWindow?.location?.pathname;

    if (!pathname) {
      return;
    }

    if (currentWindow.localStorage?.getItem("noViewer")) {
      const { viewer, visited } = await getPageview(pathname);
      setGlobalState({ viewer, visited });
      return;
    }

    void recordPageview(pathname);
    const { viewer, visited } = await getPageview(pathname);
    setGlobalState({ viewer, visited });
  };
};

export const setupPageviewLifecycle = ({
  current,
  routerEvents,
  reloadViewer,
}: SetupPageviewLifecycleOptions) => {
  const handleRouteChange = () => {
    void reloadViewer();
  };

  if (!current.hasInit) {
    current.hasInit = true;
    void reloadViewer();
  }

  routerEvents.on("routeChangeComplete", handleRouteChange);

  return () => {
    routerEvents.off("routeChangeComplete", handleRouteChange);
  };
};
