import type { CachedEnums, Prefs, Secrets, SyncMeta } from './types';

export const DEFAULT_PREFS: Prefs = {
  host: '',
  useHttpAuth: false,
  httpUser: '',
  notifications: { mode: 'none' },
  projectFilter: { mode: 'all', projectIds: [] },
  columns: { id: true, project: true, author: true, tracker: false, status: true },
  pollIntervalMinutes: 5,
  timeRoundingHours: 0.25,
  theme: 'system',
};

export const DEFAULT_SECRETS: Secrets = {
  apiKey: '',
  httpPassword: '',
};

export const DEFAULT_SYNC_META: SyncMeta = {
  lastPolledAt: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  backfilledAt: null,
  lastErrorKind: null,
  lastErrorMessage: null,
  consecutiveFailures: 0,
};

export const DEFAULT_ENUMS: CachedEnums = {
  statuses: [],
  trackers: [],
  priorities: [],
  activities: [],
  fetchedAt: null,
};

/** Retention bounds for the issue cache — v1 never evicted anything (D4). */
export const ISSUE_RETENTION_DAYS = 90;
export const ISSUE_RETENTION_MAX = 500;

/** MV3's alarm floor. */
export const MIN_POLL_INTERVAL_MINUTES = 1;
