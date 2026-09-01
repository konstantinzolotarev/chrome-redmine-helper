import type { WxtStorageItem } from 'wxt/utils/storage';

/**
 * The minimum surface needed from a storage item — structural so it does not
 * depend on the item's metadata type parameter.
 */
type StorageItemLike<T> = Pick<
  WxtStorageItem<T, Record<string, unknown>>,
  'fallback' | 'getValue' | 'setValue' | 'watch'
>;

export interface ReactiveStore<T> {
  /** Current value; reactive when read inside a component or `$derived`. */
  readonly current: T;
  /** True until the first read from storage resolves. */
  readonly loading: boolean;
  set(value: T): Promise<void>;
  update(mutate: (current: T) => T): Promise<T>;
  refresh(): Promise<void>;
  destroy(): void;
}

/**
 * Bridge a `chrome.storage` item into a Svelte 5 rune.
 *
 * This is the replacement for v1's `chrome.extension.getBackgroundPage()`. The
 * UI no longer reaches into a live background object graph — which MV3 removed,
 * and which could not have survived the service worker being torn down every
 * 30 seconds anyway. Instead every surface observes the same storage keys, so a
 * write from the side panel, the tab page or the worker mid-poll lands
 * everywhere with no message passing.
 */
export function reactiveStorage<T>(item: StorageItemLike<T>): ReactiveStore<T> {
  let value = $state<T>(item.fallback);
  let loading = $state(true);

  // Fires for writes from *any* extension context — this is the sync mechanism.
  const unwatch = item.watch((next) => {
    value = next ?? item.fallback;
  });

  void item.getValue().then((initial) => {
    value = initial;
    loading = false;
  });

  return {
    get current() {
      return value;
    },
    get loading() {
      return loading;
    },
    async set(next: T) {
      value = next;
      await item.setValue(next);
    },
    async update(mutate: (current: T) => T) {
      // Re-read from storage rather than trusting the local snapshot: the worker
      // may have written a poll result since this context last saw the value.
      // (Still not atomic — `chrome.storage` offers no CAS — but it closes the
      // window that matters in practice.)
      const next = mutate(await item.getValue());
      value = next;
      await item.setValue(next);
      return next;
    },
    async refresh() {
      value = await item.getValue();
    },
    destroy() {
      unwatch();
    },
  };
}
