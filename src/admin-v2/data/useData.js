import { useEffect, useState } from 'react';

/**
 * Small loader hook for the admin v2 data layer.
 * `fetcher` must be a stable function reference (module-level or memoized).
 */
export function useData(fetcher, ...args) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = JSON.stringify(args);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher(...JSON.parse(key))
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [fetcher, key]);

  return state;
}
