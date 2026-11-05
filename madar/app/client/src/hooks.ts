import { useCallback, useEffect, useState } from 'react';
import * as api from './api';

export interface ApiState<T> { data: T | null; error: string | null; loading: boolean; reload: () => void }

/** Fetch a GET endpoint: shows the cached copy at once, revalidates, and
    refetches after the outbox is replayed. `url` null = idle. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(() => (url ? api.peekCache<T>(url) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    let alive = true;
    const cached = api.peekCache<T>(url);
    if (cached !== null) setData(cached);
    setLoading(cached === null);
    setError(null);
    api.get<T>(url)
      .then((d) => { if (alive) { setData(d); setError(null); setLoading(false); } })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'تعذّر تحميل البيانات');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [url, tick]);

  useEffect(() => api.onApi('replayed', reload), [reload]);

  return { data, error, loading, reload };
}

/** Run an async action with loading state and error capture. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn(...args);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [fn]);
  return { run, busy, error, setError };
}
