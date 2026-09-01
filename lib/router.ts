/**
 * Minimal hash routing.
 *
 * A dependency would be more than this needs: there are six routes and one
 * optional id segment. Hash routing also preserves v1's deep links — the
 * context menu still navigates to `#/new-issue`.
 */

export interface Route {
  /** Normalised path, always leading-slash, never trailing. */
  path: string;
  segments: string[];
}

export function parseHash(hash: string, fallback = '/issues'): Route {
  const raw = hash.replace(/^#/, '').trim();
  const path = raw === '' || raw === '/' ? fallback : `/${raw.replace(/^\/+|\/+$/g, '')}`;
  return { path, segments: path.slice(1).split('/').filter(Boolean) };
}

/** The numeric id in `/issues/42`, or null. */
export function idSegment(route: Route, at = 1): number | null {
  const value = route.segments[at];
  if (value === undefined) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function routeName(route: Route): string {
  return route.segments[0] ?? '';
}
