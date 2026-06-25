import { useCallback, useEffect, useRef, useState } from "react";

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  stale: boolean; // true when showing previously-fetched data after a failed refresh
}

// Fetch + optional polling. Keeps last good data on error (offline-first) and
// flags it stale so the UI can show a banner rather than going blank.
export function useApi<T>(fetcher: () => Promise<T>, intervalMs = 0, deps: unknown[] = []): State<T> & { refetch: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true, stale: false });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    try {
      const data = await fetcherRef.current();
      setState({ data, error: null, loading: false, stale: false });
    } catch (e) {
      setState((prev) => ({
        data: prev.data,
        error: e instanceof Error ? e.message : "request failed",
        loading: false,
        stale: prev.data !== null,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    run();
    if (intervalMs > 0) {
      const id = setInterval(run, intervalMs);
      return () => clearInterval(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, ...deps]);

  return { ...state, refetch: run };
}
