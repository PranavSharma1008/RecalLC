import { useEffect, useState } from 'react';

/**
 * A tiny hash router.
 *
 * Extension pages are served from `chrome-extension://…/index.html`, so a
 * hash router is the simplest thing that works reliably — no history API
 * rewriting, no server rewrites, and deep links survive a page reload.
 */

export interface Route {
  /** Path without the leading `#`, e.g. "problems" or "recall/two-sum". */
  path: string;
  segments: string[];
}

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '').replace(/^\//, '');
  const [pathPart = ''] = raw.split('?');
  const path = pathPart.replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);
  return { path, segments };
}

export function useHashRoute(): [Route, (path: string) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (window.location.hash === `#${normalized}`) return;
    window.location.hash = normalized;
  };

  return [route, navigate];
}

/** Query parameters of the current hash route. */
export function useRouteQuery(): URLSearchParams {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? ''));

  useEffect(() => {
    const onChange = () => setQuery(new URLSearchParams(window.location.hash.split('?')[1] ?? ''));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return query;
}
