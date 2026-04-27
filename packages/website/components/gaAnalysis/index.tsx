import React, { useEffect } from "react";
export default function (props: { id: string }) {
  useEffect(() => {
    if (!props.id) {
      return;
    }

    let cancelled = false;

    const inject = () => {
      if (cancelled || document.querySelector(`script[data-vanblog-ga='${props.id}']`)) {
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.googletagmanager.com/gtag/js?id=${props.id}`;
      script.async = true;
      script.dataset.vanblogGa = props.id;
      document.head.appendChild(script);

      const inline = document.createElement("script");
      inline.dataset.vanblogGaInit = props.id;
      inline.text = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){window.dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${props.id}');
      `;
      document.head.appendChild(inline);
    };

    const trigger = () => {
      inject();
      removeListeners();
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll"];
    const removeListeners = () =>
      events.forEach((eventName) => window.removeEventListener(eventName, trigger));
    events.forEach((eventName) =>
      window.addEventListener(eventName, trigger, { once: true, passive: true }),
    );

    const browserWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let cancelScheduled: () => void;
    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(() => inject(), { timeout: 4000 });
      cancelScheduled = () => browserWindow.cancelIdleCallback?.(idleId);
    } else {
      const timeoutId = browserWindow.setTimeout(inject, 2000);
      cancelScheduled = () => browserWindow.clearTimeout(timeoutId);
    }

    return () => {
      cancelled = true;
      removeListeners();
      cancelScheduled();
    };
  }, [props.id]);

  return null;
}
