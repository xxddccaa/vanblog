const DEFAULT_PAGEVIEW_RESPONSE = { viewer: 0, visited: 0 };

export interface PageViewData {
  viewer: number;
  visited: number;
}

export const getPageview = async (_pathname?: string): Promise<PageViewData> => {
  try {
    const { statusCode, data } = await fetch(
      `/api/public/viewer`,
      {method: "GET"}
    ).then((res) => res.json());

    return statusCode === 233 ? DEFAULT_PAGEVIEW_RESPONSE : data;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export const recordPageview = async (
  pathname: string
): Promise<void> => {
  const hasVisited = window.localStorage.getItem("visited");
  const hasVisitedCurrentPath = window.localStorage.getItem(
    `visited-${pathname}`
  );

  if (!hasVisited) {
    window.localStorage.setItem("visited", "true");
  }

  if (!hasVisitedCurrentPath) {
    window.localStorage.setItem(`visited-${pathname}`, "true");
  }

  const url = `/api/public/viewer?isNew=${!hasVisited}&isNewByPath=${!hasVisitedCurrentPath}`;

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(url, new Blob([], { type: "text/plain;charset=UTF-8" }));
      if (ok) {
        return;
      }
    }

    await fetch(url, {
      method: "POST",
      keepalive: true,
    });
  } catch (err) {
    console.log(err);
  }
};
