import { useCallback, useEffect, useState } from 'react';
import { getInitialState } from '@/app';

export type InitialStateType = Awaited<ReturnType<typeof getInitialState>> | undefined;

const initState = {
  initialState: undefined as InitialStateType,
  loading: true,
  error: undefined,
};

export default function useInitialStateModel() {
  const [state, setState] = useState(initState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const result = await getInitialState();
      setState((current) => ({ ...current, initialState: result, loading: false }));
    } catch (error) {
      setState((current) => ({ ...current, error, loading: false }));
    }
  }, []);

  const setInitialState = useCallback(
    async (
      initialState: InitialStateType | ((current: InitialStateType) => InitialStateType),
    ) => {
      setState((current) => {
        if (typeof initialState === 'function') {
          return {
            ...current,
            initialState: initialState(current.initialState),
            loading: false,
          };
        }

        return {
          ...current,
          initialState,
          loading: false,
        };
      });
    },
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    setInitialState,
  };
}
