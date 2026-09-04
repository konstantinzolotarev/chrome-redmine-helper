import { storage } from 'wxt/utils/storage';

import {
  DEFAULT_ENUMS,
  DEFAULT_PREFS,
  DEFAULT_SECRETS,
  DEFAULT_SYNC_META,
} from './defaults';
import type {
  CachedEnums,
  IssueCache,
  Prefs,
  ProjectCache,
  ReadState,
  Secrets,
  SyncMeta,
  TimerState,
  UnsentSession,
} from './types';

/**
 * Every storage key the extension owns, declared in one place.
 *
 * `chrome.storage` is the source of truth for the whole extension: the service
 * worker writes what it polls, the UI writes what the user does, and both
 * observe the same keys. That is what replaces v1's
 * `chrome.extension.getBackgroundPage()`, which handed the UI a live reference
 * to the background page's object graph — an arrangement MV3 removed outright.
 */

// --- synced preferences ------------------------------------------------------

export const prefsItem = storage.defineItem<Prefs>('sync:prefs', {
  fallback: DEFAULT_PREFS,
  version: 2,
  migrations: {
    // `fallback` only applies when the whole value is missing, so a profile
    // stored before the table gained paging has no `pageSize` at all.
    2: (prefs: Prefs): Prefs => ({ ...prefs, pageSize: DEFAULT_PREFS.pageSize }),
  },
});

// --- local credentials -------------------------------------------------------

export const secretsItem = storage.defineItem<Secrets>('local:secrets', {
  fallback: DEFAULT_SECRETS,
  version: 1,
});

// --- local caches ------------------------------------------------------------

export const issuesItem = storage.defineItem<IssueCache>('local:issues', {
  fallback: {},
  version: 1,
});

export const readStateItem = storage.defineItem<ReadState>('local:readState', {
  fallback: {},
  version: 1,
});

export const projectsItem = storage.defineItem<ProjectCache>('local:projects', {
  fallback: {},
  version: 1,
});

/** Assignable users per project id, for the assignee picker. */
export const membersItem = storage.defineItem<Record<string, Array<{ id: number; name: string }>>>(
  'local:members',
  { fallback: {}, version: 1 },
);

export const enumsItem = storage.defineItem<CachedEnums>('local:enums', {
  fallback: DEFAULT_ENUMS,
  version: 1,
});

/**
 * The authenticated Redmine user.
 *
 * Lets the UI tell an assigned issue from a watched one without extra
 * bookkeeping: every issue in the cache came from one of those two queries, so
 * anything not assigned to this user is one they watch.
 */
export const currentUserItem = storage.defineItem<{ id: number; name: string } | null>(
  'local:currentUser',
  { fallback: null, version: 1 },
);

export const syncMetaItem = storage.defineItem<SyncMeta>('local:syncMeta', {
  fallback: DEFAULT_SYNC_META,
  version: 1,
});

// --- time tracking -----------------------------------------------------------

export const timerItem = storage.defineItem<TimerState | null>('local:timer', {
  fallback: null,
  version: 1,
});

export const unsentSessionsItem = storage.defineItem<UnsentSession[]>('local:unsentSessions', {
  fallback: [],
  version: 1,
});

// --- ephemeral ---------------------------------------------------------------

/**
 * Text selected when the context menu was used.
 *
 * `session` rather than a background global: v1 kept this in `var selectedText`
 * on the background page, which MV3 discards every time the worker is torn down
 * (D8). Session storage survives that and clears when the browser closes.
 */
export const contextSelectionItem = storage.defineItem<string>('session:contextSelection', {
  fallback: '',
});
