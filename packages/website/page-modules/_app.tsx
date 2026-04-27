import "../styles/globals.css";
import "../styles/side-bar.css";
import "../styles/var.css";
import "../styles/tip-card.css";
import "../styles/loader.css";
import "../styles/scrollbar.css";
import type { AppProps } from "next/app";
import { GlobalContext, GlobalState } from "../utils/globalContext";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getPageview, recordPageview } from "../api/pageview";
import Head from "next/head";
import { createReloadViewer, setupPageviewLifecycle } from "../utils/pageviewLifecycle";

function MyApp({ Component, pageProps }: AppProps) {
  const { current } = useRef({ hasInit: false });
  const [globalState, setGlobalState] = useState<GlobalState>({
    viewer: 0,
    visited: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const reloadViewer = createReloadViewer({
      getWindow: () => (typeof window === "undefined" ? undefined : window),
      getPageview,
      recordPageview,
      setGlobalState,
    });

    return setupPageviewLifecycle({
      current,
      routerEvents: router.events,
      reloadViewer,
    });
  }, [current, router.events]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalContext.Provider
        value={{ state: globalState, setState: setGlobalState }}
      >
        <Component {...pageProps} />
      </GlobalContext.Provider>
    </>
  );
}

export default MyApp;
