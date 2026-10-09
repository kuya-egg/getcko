// One async read with loading, error and reload. Nothing heavier (no cache, no global store).
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export interface Resource<T> {
  /** Last loaded value; kept while reloading so the screen doesn't blank. */
  data: T | undefined;
  error: unknown;
  /** True until the first load settles, and during reload(). */
  loading: boolean;
  /** Run the loader again. Resolves when it settles. */
  reload: () => Promise<void>;
  /** Replace the value locally (after a create/update/delete, or from an event). */
  setData: (next: T | ((prev: T | undefined) => T)) => void;
}

/**
 *   const kbs = useResource(kbList, []);
 *   if (kbs.loading && !kbs.data) return <Loading />;
 *   if (kbs.error) { const c = errorCopy(kbs.error); return <ErrorNotice title={c.title} onRetry={kbs.reload}>{c.body}</ErrorNotice>; }
 */
export function useResource<T>(load: () => Promise<T>, deps: DependencyList): Resource<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const value = await loadRef.current();
      if (id !== seq.current) return;
      setDataState(value);
      setError(undefined);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      seq.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((next: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof next === "function" ? (next as (p: T | undefined) => T)(prev) : next));
  }, []);

  return { data, error, loading, reload, setData };
}

/** True once `ms` has passed while `active` stays true. Loading moments wait 300ms (no flash). */
export function useDelayed(active: boolean, ms = 300): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), ms);
    return () => window.clearTimeout(t);
  }, [active, ms]);
  return shown;
}
