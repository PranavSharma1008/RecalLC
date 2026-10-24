import { useCallback, useEffect, useRef, useState } from 'react';

import { invalidateServiceCache } from '../services/messaging';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (updater: T | ((current: T | null) => T | null)) => void;
}

/**
 * Load data from the background worker, with an explicit reload trigger.
 * `deps` behaves like a `useEffect` dependency list.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((result) => {
        if (cancelled || !mounted.current) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(cause instanceof Error ? cause.message : 'Something went wrong.');
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => {
    invalidateServiceCache();
    setNonce((value) => value + 1);
  }, []);

  const update = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setData((current) =>
      typeof updater === 'function' ? (updater as (value: T | null) => T | null)(current) : updater,
    );
  }, []);

  return { data, loading, error, reload, setData: update };
}
