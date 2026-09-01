import { browser } from 'wxt/browser';

import {
  RedmineClient,
  isRedmineError,
  listIssueStatuses,
  listIssuePriorities,
  listTimeEntryActivities,
  listIssues,
  listTrackers,
  getCurrentUser,
  originPattern,
  type Issue,
} from '@/lib/redmine';
import { countUnread, mergeIssues, pruneIssues, pruneReadState } from '@/lib/store/derive';
import {
  currentUserItem,
  enumsItem,
  issuesItem,
  prefsItem,
  readStateItem,
  secretsItem,
  syncMetaItem,
  timerItem,
  unsentSessionsItem,
} from '@/lib/store/items';
import type { Prefs, Secrets, SyncMeta } from '@/lib/store/types';

import { setErrorBadge, setUnreadBadge } from './badge';
import { notifyIssues } from './notify';

/** Upper bound on the first-run backfill, so a huge Redmine cannot stall setup. */
export const BACKFILL_MAX_ISSUES = 300;
const ENUM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PollOutcome {
  status: 'ok' | 'skipped' | 'unconfigured' | 'no-permission' | 'error';
  fetched?: number;
  created?: number;
  updated?: number;
  unread?: number;
  error?: string;
}

/**
 * Exponential backoff after failures, capped at an hour.
 *
 * v1 retried on the same fixed 5-minute alarm forever and cleared the badge on
 * every attempt, so a misconfigured host produced a permanent silent retry loop.
 */
export function backoffMinutes(failures: number, intervalMinutes: number): number {
  if (failures <= 0) return 0;
  return Math.min(60, intervalMinutes * 2 ** Math.min(failures - 1, 5));
}

export function shouldSkipPoll(meta: SyncMeta, now: Date, intervalMinutes: number): boolean {
  const wait = backoffMinutes(meta.consecutiveFailures, intervalMinutes);
  if (wait === 0 || !meta.lastAttemptAt) return false;

  const since = now.getTime() - Date.parse(meta.lastAttemptAt);
  return Number.isFinite(since) && since < wait * 60_000;
}

/**
 * Advance the delta floor using the newest `updated_on` the server reported.
 *
 * Deliberately not the local clock: the filter is evaluated against Redmine's
 * clock, and any skew between the two would silently drop issues updated inside
 * the offset. Using a server value makes the boundary self-consistent. The
 * filter is `>=`, so the boundary issue is re-fetched next poll — harmless,
 * because merging is idempotent.
 */
export function nextPollFloor(previous: string | null, issues: Issue[]): string | null {
  let newest = previous;
  for (const issue of issues) {
    if (!newest || Date.parse(issue.updated_on) > Date.parse(newest)) {
      newest = issue.updated_on;
    }
  }
  return newest;
}

function buildClient(prefs: Prefs, secrets: Secrets): RedmineClient {
  return new RedmineClient({
    host: prefs.host,
    apiKey: secrets.apiKey,
    useHttpAuth: prefs.useHttpAuth,
    httpUser: prefs.httpUser,
    httpPassword: secrets.httpPassword,
  });
}

function selectedProjectIds(prefs: Prefs): number[] | undefined {
  const { mode, projectIds } = prefs.projectFilter;
  return mode === 'selected' && projectIds.length > 0 ? projectIds : undefined;
}

async function hasHostPermission(host: string): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: [originPattern(host)] });
  } catch {
    return false;
  }
}

/** Enumerations change rarely; refresh at most daily, and never fail a poll. */
async function refreshEnums(client: RedmineClient): Promise<void> {
  const cached = await enumsItem.getValue();
  const age = cached.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
  if (age < ENUM_MAX_AGE_MS && cached.statuses.length > 0) return;

  try {
    const [statuses, trackers, priorities, activities] = await Promise.all([
      listIssueStatuses(client),
      listTrackers(client),
      listIssuePriorities(client),
      listTimeEntryActivities(client),
    ]);
    await enumsItem.setValue({
      statuses,
      trackers,
      priorities,
      activities,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[redmine-helper] enum refresh failed', error);
  }
}

/** Cached so the UI can distinguish assigned issues from watched ones. */
async function refreshCurrentUser(client: RedmineClient): Promise<void> {
  if ((await currentUserItem.getValue()) !== null) return;
  try {
    const user = await getCurrentUser(client);
    await currentUserItem.setValue({
      id: user.id,
      name: `${user.firstname} ${user.lastname}`.trim(),
    });
  } catch (error) {
    console.warn('[redmine-helper] could not identify current user', error);
  }
}

async function recordFailure(meta: SyncMeta, kind: string, message: string): Promise<void> {
  await syncMetaItem.setValue({
    ...meta,
    lastAttemptAt: new Date().toISOString(),
    lastErrorKind: kind,
    lastErrorMessage: message,
    consecutiveFailures: meta.consecutiveFailures + 1,
  });
  await setErrorBadge(message);
}

/**
 * One poll cycle.
 *
 * First run does a bounded backfill; every run after that asks only for issues
 * updated since the last floor — two requests, against v1's recursive re-page
 * through the entire assigned set every five minutes (D7).
 */
export async function runPoll(options: { force?: boolean } = {}): Promise<PollOutcome> {
  const [prefs, secrets, meta] = await Promise.all([
    prefsItem.getValue(),
    secretsItem.getValue(),
    syncMetaItem.getValue(),
  ]);

  if (!prefs.host || !secrets.apiKey) {
    await setUnreadBadge(0);
    return { status: 'unconfigured' };
  }

  if (!options.force && shouldSkipPoll(meta, new Date(), prefs.pollIntervalMinutes)) {
    return { status: 'skipped' };
  }

  if (!(await hasHostPermission(prefs.host))) {
    await recordFailure(meta, 'permission', 'No permission for this Redmine host.');
    return { status: 'no-permission' };
  }

  const client = buildClient(prefs, secrets);
  const isBackfill = meta.backfilledAt === null;
  const projectIds = selectedProjectIds(prefs);

  try {
    const shared = {
      status: 'all' as const,
      projectIds,
      // On a delta poll the floor is the newest server timestamp already seen.
      updatedSince: isBackfill ? undefined : (meta.lastPolledAt ?? undefined),
    };

    const [assigned, watched] = await Promise.all([
      listIssues(client, { ...shared, assignedToMe: true }, { maxItems: isBackfill ? BACKFILL_MAX_ISSUES : undefined }),
      listIssues(client, { ...shared, watchedByMe: true }, { maxItems: isBackfill ? BACKFILL_MAX_ISSUES : undefined }),
    ]);

    // Watched and assigned overlap; de-duplicate before merging.
    const byId = new Map<number, Issue>();
    for (const issue of [...assigned, ...watched]) byId.set(issue.id, issue);
    const fetched = [...byId.values()];

    const cache = await issuesItem.getValue();
    const created: Issue[] = [];
    const updated: Issue[] = [];

    for (const issue of fetched) {
      const existing = cache[String(issue.id)];
      if (!existing) created.push(issue);
      else if (existing.updated_on !== issue.updated_on) updated.push(issue);
    }

    // Pin anything the user still has work attached to, so retention cannot
    // evict an issue with a running timer or a queued time entry.
    const [timer, unsent] = await Promise.all([timerItem.getValue(), unsentSessionsItem.getValue()]);
    const pinned = new Set<number>(unsent.map((session) => session.issueId));
    if (timer) pinned.add(timer.issueId);

    const merged = pruneIssues(mergeIssues(cache, fetched), { pinned });
    await issuesItem.setValue(merged);

    const keptIds = Object.keys(merged).map(Number);
    const readState = await readStateItem.getValue();
    await readStateItem.setValue(pruneReadState(readState, keptIds));

    const unread = countUnread(Object.values(merged), readState);
    await setUnreadBadge(unread);

    await syncMetaItem.setValue({
      ...meta,
      lastPolledAt: nextPollFloor(meta.lastPolledAt, fetched) ?? new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      backfilledAt: meta.backfilledAt ?? new Date().toISOString(),
      lastErrorKind: null,
      lastErrorMessage: null,
      consecutiveFailures: 0,
    });

    await refreshEnums(client);
    await refreshCurrentUser(client);

    // Never notify for the backfill: on first run every issue is "new", and
    // announcing three hundred of them is not useful.
    if (!isBackfill) {
      await notifyIssues(prefs.notifications.mode, created, updated);
    }

    return {
      status: 'ok',
      fetched: fetched.length,
      created: created.length,
      updated: updated.length,
      unread,
    };
  } catch (error) {
    const kind = isRedmineError(error) ? error.kind : 'network';
    const message = isRedmineError(error) ? error.describe() : String(error);
    await recordFailure(meta, kind, message);
    return { status: 'error', error: message };
  }
}
