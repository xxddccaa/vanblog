import React from 'react';
import { useModel } from '@umijs/max';

function Loading() {
  return <div />;
}

export default function InitialStateProvider(props: { children: React.ReactNode }) {
  const { loading = false } = useModel('@@initialState') || {};
  const appLoaded = React.useRef(false);

  React.useEffect(() => {
    if (!loading) {
      appLoaded.current = true;
    }
  }, [loading]);

  if (loading && !appLoaded.current && typeof window !== 'undefined') {
    return <Loading />;
  }

  return <>{props.children}</>;
}
