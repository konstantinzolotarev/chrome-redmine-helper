import { browser } from 'wxt/browser';

import { normalizeHost } from '@/lib/redmine';
import { DEFAULT_PREFS, DEFAULT_SECRETS } from '@/lib/store/defaults';
import { prefsItem, secretsItem, unsentSessionsItem } from '@/lib/store/items';
import type { NotificationMode, Prefs, ProjectFilterMode, Secrets, UnsentSession } from '@/lib/store/types';
import { hoursFromMs, localDateIso, roundHours } from '@/lib/time';

/**
 * Migration from Redmine Helper 1.6.6.
 *
 * 1.6.6 kept its profile in `chrome.storage.sync.profile` and its caches in
 * `chrome.storage.local` under `issues`, `projects`, `users` and `timelines`.
 * The caches are disposable — they refetch — but `timelines` is not: it holds
 * time the user tracked that was never sent to Redmine, because v1 had no
 * time-logging code at all. Those sessions are carried over into the unsent
 * queue so they can still be logged.
 */

export interface V1Profile {
  chiliProject?: boolean;
  host?: string;
  apiAccessKey?: string;
  useHttpAuth?: boolean;
  httpUser?: string;
  httpPass?: string;
  selectedProject?: number | false;
  currentUserName?: string | false;
  currentUserId?: number | false;
  hideHints?: boolean;
  notifications?: { show?: string };
  projects?: { show_for?: string; list?: number[] };
  table?: { id?: boolean; project?: boolean; author?: boolean; tracker?: boolean; status?: boolean };
}

export interface V1Timeline {
  issueId?: number;
  start?: string;
  end?: string | null;
  /** Milliseconds, present only on sessions v1 stopped explicitly. */
  spent?: number;
}

export type V1Timelines = Record<string, V1Timeline[]>;

const NOTIFICATION_MODES: readonly string[] = ['none', 'new', 'updated'];
const PROJECT_FILTER_MODES: readonly string[] = ['all', 'selected'];

export function mapProfile(profile: V1Profile | null | undefined): {
  prefs: Prefs;
  secrets: Secrets;
} {
  if (!profile) return { prefs: { ...DEFAULT_PREFS }, secrets: { ...DEFAULT_SECRETS } };

  let host = '';
  if (profile.host) {
    try {
      host = normalizeHost(profile.host);
    } catch {
      // v1 accepted anything; a host we cannot parse is dropped rather than
      // carried forward as a value that would fail every request.
      host = '';
    }
  }

  const mode = profile.notifications?.show;
  const filterMode = profile.projects?.show_for;

  return {
    prefs: {
      ...DEFAULT_PREFS,
      host,
      useHttpAuth: profile.useHttpAuth ?? false,
      httpUser: profile.httpUser ?? '',
      notifications: {
        mode: NOTIFICATION_MODES.includes(mode ?? '')
          ? (mode as NotificationMode)
          : DEFAULT_PREFS.notifications.mode,
      },
      projectFilter: {
        mode: PROJECT_FILTER_MODES.includes(filterMode ?? '')
          ? (filterMode as ProjectFilterMode)
          : DEFAULT_PREFS.projectFilter.mode,
        projectIds: (profile.projects?.list ?? []).filter((id) => typeof id === 'number'),
      },
      columns: {
        id: profile.table?.id ?? DEFAULT_PREFS.columns.id,
        project: profile.table?.project ?? DEFAULT_PREFS.columns.project,
        author: profile.table?.author ?? DEFAULT_PREFS.columns.author,
        tracker: profile.table?.tracker ?? DEFAULT_PREFS.columns.tracker,
        status: profile.table?.status ?? DEFAULT_PREFS.columns.status,
      },
    },
    secrets: {
      apiKey: profile.apiAccessKey ?? '',
      httpPassword: profile.httpPass ?? '',
    },
    // `chiliProject`, `selectedProject`, `currentUserId`, `currentUserName` and
    // `hideHints` are intentionally dropped: ChiliProject has been archived
    // since 2015, and the rest are either derivable or no longer meaningful.
  };
}

export function mapTimelines(
  timelines: V1Timelines | null | undefined,
  options: {
    subjects?: Record<string, string>;
    roundingHours?: number;
    newId?: () => string;
  } = {},
): UnsentSession[] {
  if (!timelines) return [];

  const subjects = options.subjects ?? {};
  const rounding = options.roundingHours ?? DEFAULT_PREFS.timeRoundingHours;
  const newId = options.newId ?? (() => crypto.randomUUID());

  const sessions: UnsentSession[] = [];

  for (const [issueKey, entries] of Object.entries(timelines)) {
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      const issueId = entry.issueId ?? Number(issueKey);
      if (!Number.isFinite(issueId) || !entry.start) continue;

      const start = Date.parse(entry.start);
      // Sessions v1 never closed have no end and no duration — there is nothing
      // to log, so they are dropped rather than invented.
      if (!entry.end || Number.isNaN(start)) continue;

      const end = Date.parse(entry.end);
      if (Number.isNaN(end) || end <= start) continue;

      const elapsedMs = entry.spent ?? end - start;
      const hours = roundHours(hoursFromMs(elapsedMs), rounding);
      if (hours <= 0) continue;

      sessions.push({
        id: newId(),
        issueId,
        issueSubject: subjects[String(issueId)] ?? `Issue #${issueId}`,
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(end).toISOString(),
        hours,
        // Local day, not the UTC slice — see localDateIso.
        spentOn: localDateIso(new Date(start)),
        activityId: null,
        comments: '',
        attempts: 0,
        lastError: null,
      });
    }
  }

  return sessions;
}

/** Subjects from v1's issue cache, so migrated sessions are recognisable. */
export function extractSubjects(legacyIssues: unknown): Record<string, string> {
  const subjects: Record<string, string> = {};
  const container = (legacyIssues as { issues?: Record<string, { subject?: string }> } | null)?.issues;
  if (!container || typeof container !== 'object') return subjects;

  for (const [id, issue] of Object.entries(container)) {
    if (issue && typeof issue.subject === 'string') subjects[id] = issue.subject;
  }
  return subjects;
}

export interface MigrationResult {
  migrated: boolean;
  hadProfile: boolean;
  carriedSessions: number;
}

const LEGACY_LOCAL_KEYS = ['issues', 'projects', 'users', 'timelines'];

/**
 * Run the migration. Idempotent: once the legacy keys are gone it does nothing.
 */
export async function migrateFromV1(): Promise<MigrationResult> {
  const [syncData, localData] = await Promise.all([
    browser.storage.sync.get('profile'),
    browser.storage.local.get(LEGACY_LOCAL_KEYS),
  ]);

  const profile = syncData.profile as V1Profile | undefined;
  const timelines = localData.timelines as V1Timelines | undefined;

  if (!profile && !timelines) {
    return { migrated: false, hadProfile: false, carriedSessions: 0 };
  }

  const { prefs, secrets } = mapProfile(profile);
  const sessions = mapTimelines(timelines, {
    subjects: extractSubjects(localData.issues),
    roundingHours: prefs.timeRoundingHours,
  });

  if (profile) {
    await Promise.all([prefsItem.setValue(prefs), secretsItem.setValue(secrets)]);
  }

  if (sessions.length > 0) {
    const existing = await unsentSessionsItem.getValue();
    await unsentSessionsItem.setValue([...existing, ...sessions]);
  }

  // Only now remove the legacy keys, so a failure above leaves them recoverable.
  await Promise.all([
    browser.storage.sync.remove('profile'),
    browser.storage.local.remove(LEGACY_LOCAL_KEYS),
  ]);

  return { migrated: true, hadProfile: Boolean(profile), carriedSessions: sessions.length };
}
