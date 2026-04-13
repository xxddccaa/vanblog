import React from 'react';
import InitialStateProvider from './InitialStateProvider';

export function dataflowProvider(container: React.ReactNode) {
  return <InitialStateProvider>{container}</InitialStateProvider>;
}
