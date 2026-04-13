'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { GlobalContext, GlobalState } from '../utils/globalContext';
import { getPageview, recordPageview } from '../api/pageview';
import { createReloadViewer } from '../utils/pageviewLifecycle';

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { current } = useRef({ hasInit: false });
  const [globalState, setGlobalState] = useState<GlobalState>({
    viewer: 0,
    visited: 0,
  });

  useEffect(() => {
    const reloadViewer = createReloadViewer({
      getWindow: () => (typeof window === 'undefined' ? undefined : window),
      getPageview,
      recordPageview,
      setGlobalState,
    });

    if (!current.hasInit) {
      current.hasInit = true;
    }

    void reloadViewer();
  }, [current, pathname]);

  return (
    <GlobalContext.Provider value={{ state: globalState, setState: setGlobalState }}>
      {children}
    </GlobalContext.Provider>
  );
}
