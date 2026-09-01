import { parseHash, type Route } from './router';

/** Reactive view of `location.hash`. */
export function useRoute(fallback = '/issues'): { readonly current: Route } {
  let route = $state<Route>(parseHash(globalThis.location?.hash ?? '', fallback));

  $effect(() => {
    const onChange = () => {
      route = parseHash(globalThis.location.hash, fallback);
    };
    globalThis.addEventListener('hashchange', onChange);
    return () => globalThis.removeEventListener('hashchange', onChange);
  });

  return {
    get current() {
      return route;
    },
  };
}

export function navigate(path: string): void {
  globalThis.location.hash = path.startsWith('/') ? path : `/${path}`;
}
