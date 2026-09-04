import type { Enumeration, Issue, IssueStatus, Project, Tracker } from '@/lib/redmine';

export type NotificationMode = 'none' | 'new' | 'updated';
export type ProjectFilterMode = 'all' | 'selected';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Which columns the wide tab-page issue table shows. */
export interface ColumnPrefs {
  id: boolean;
  project: boolean;
  author: boolean;
  tracker: boolean;
  status: boolean;
}

/**
 * Non-secret preferences. Stored in `sync` so they follow the user between
 * devices, exactly as v1's `chrome.storage.sync.profile` did — minus the API key
 * and HTTP password, which now live in `local` (see `Secrets`).
 */
export interface Prefs {
  host: string;
  useHttpAuth: boolean;
  httpUser: string;
  notifications: { mode: NotificationMode };
  projectFilter: { mode: ProjectFilterMode; projectIds: number[] };
  columns: ColumnPrefs;
  /** Rows per page in the full-page issue table. */
  pageSize: number;
  pollIntervalMinutes: number;
  /** Rounding increment applied to tracked time before logging, in hours. */
  timeRoundingHours: number;
  theme: ThemePreference;
}

/**
 * Credentials. Deliberately in `local`, not `sync`: syncing round-trips through
 * Google's servers, and a Redmine API key is a full-privilege credential.
 */
export interface Secrets {
  apiKey: string;
  httpPassword: string;
}

export interface SyncMeta {
  /**
   * Floor for the next delta poll. Holds a *server* timestamp (the newest
   * `updated_on` seen), never a local clock reading — see `poller.ts`.
   */
  lastPolledAt: string | null;
  /** Local clock; drives retry backoff, which must not depend on server time. */
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  /** Set once the initial bounded backfill has run. */
  backfilledAt: string | null;
  lastErrorKind: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
}

export interface CachedEnums {
  statuses: IssueStatus[];
  trackers: Tracker[];
  priorities: Enumeration[];
  activities: Enumeration[];
  fetchedAt: string | null;
}

/** Storage JSON object keys are strings, so issue ids are stringified. */
export type IssueCache = Record<string, Issue>;
export type ProjectCache = Record<string, Project>;

/**
 * When each issue was last read.
 *
 * Kept apart from the issue payload on purpose. v1 mutated a `read` boolean onto
 * the cached issue, so any refetch clobbered it (D3), and maintained a separate
 * `unread` counter by hand that drifted out of step (D2). Unread is now derived:
 * `issue.updated_on > readAt`.
 */
export type ReadState = Record<string, string>;

export interface TimerState {
  issueId: number;
  issueSubject: string;
  startedAt: string;
}

/**
 * A finished tracking session that has not reached Redmine yet — either the
 * POST failed, or the user has not filled in the log form. Nothing is discarded
 * silently.
 */
export interface UnsentSession {
  id: string;
  issueId: number;
  issueSubject: string;
  startedAt: string;
  endedAt: string;
  hours: number;
  /** YYYY-MM-DD */
  spentOn: string;
  activityId: number | null;
  comments: string;
  attempts: number;
  lastError: string | null;
}
