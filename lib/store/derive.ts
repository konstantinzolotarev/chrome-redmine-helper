import type { Issue } from '@/lib/redmine';

import { ISSUE_RETENTION_DAYS, ISSUE_RETENTION_MAX } from './defaults';
import type { IssueCache, ReadState } from './types';

type IssueLike = Pick<Issue, 'id' | 'updated_on'>;

/**
 * An issue is unread if it has never been read, or has been updated since it
 * was last read.
 *
 * Derived rather than stored. v1 kept a `read` boolean on the cached issue and
 * a hand-maintained `unread` counter; the boolean was clobbered by refetches
 * (D3) and the counter drifted (D2) because `markAsRead`/`markAsUnRead`
 * incremented it independently of `updateUnread`'s recount.
 */
export function isUnread(issue: IssueLike, readState: ReadState): boolean {
  const readAt = readState[String(issue.id)];
  if (!readAt) return true;

  const updated = Date.parse(issue.updated_on);
  const read = Date.parse(readAt);
  // A malformed timestamp should not hide an issue.
  if (Number.isNaN(updated) || Number.isNaN(read)) return true;

  return updated > read;
}

export function unreadIssues<T extends IssueLike>(issues: T[], readState: ReadState): T[] {
  return issues.filter((issue) => isUnread(issue, readState));
}

export function countUnread(issues: IssueLike[], readState: ReadState): number {
  let count = 0;
  for (const issue of issues) if (isUnread(issue, readState)) count += 1;
  return count;
}

export function markRead(
  readState: ReadState,
  issueId: number,
  at: Date = new Date(),
): ReadState {
  return { ...readState, [String(issueId)]: at.toISOString() };
}

/** Removing the entry is what makes an issue unread again. */
export function markUnread(readState: ReadState, issueId: number): ReadState {
  const { [String(issueId)]: _removed, ...rest } = readState;
  return rest;
}

export function markAllRead(
  readState: ReadState,
  issues: IssueLike[],
  at: Date = new Date(),
): ReadState {
  const next = { ...readState };
  const stamp = at.toISOString();
  for (const issue of issues) next[String(issue.id)] = stamp;
  return next;
}

/** Drop read-state entries for issues no longer in the cache. */
export function pruneReadState(readState: ReadState, keepIds: Iterable<number>): ReadState {
  const keep = new Set([...keepIds].map(String));
  const next: ReadState = {};
  for (const [id, readAt] of Object.entries(readState)) {
    if (keep.has(id)) next[id] = readAt;
  }
  return next;
}

/**
 * Fold a freshly fetched issue into the cache.
 *
 * `include=`d collections (journals, attachments, relations) only arrive on a
 * detail fetch, so a list-shaped response must not wipe them — but they must
 * also not survive as stale data once the issue has changed upstream.
 */
export function mergeIssue(existing: Issue | undefined, incoming: Issue): Issue {
  if (!existing) return incoming;

  const merged: Issue = { ...existing, ...incoming };

  if (existing.updated_on !== incoming.updated_on) {
    if (incoming.journals === undefined) delete merged.journals;
    if (incoming.attachments === undefined) delete merged.attachments;
    if (incoming.relations === undefined) delete merged.relations;
  }

  return merged;
}

export function mergeIssues(cache: IssueCache, incoming: Issue[]): IssueCache {
  const next: IssueCache = { ...cache };
  for (const issue of incoming) {
    next[String(issue.id)] = mergeIssue(next[String(issue.id)], issue);
  }
  return next;
}

export interface PruneOptions {
  now?: Date;
  maxAgeDays?: number;
  maxCount?: number;
  /** Never evicted — an issue with a running timer or a queued time entry. */
  pinned?: Iterable<number>;
}

/**
 * Bound the issue cache.
 *
 * v1's `com.rdHelper.Issues.issues` grew without limit for the life of the
 * install (D4), which is also why it needed `unlimitedStorage`.
 */
export function pruneIssues(cache: IssueCache, options: PruneOptions = {}): IssueCache {
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? ISSUE_RETENTION_DAYS;
  const maxCount = options.maxCount ?? ISSUE_RETENTION_MAX;
  const pinned = new Set([...(options.pinned ?? [])].map(String));

  const cutoff = now.getTime() - maxAgeDays * 86_400_000;

  const entries = Object.entries(cache);
  const kept = entries.filter(([id, issue]) => {
    if (pinned.has(id)) return true;
    const updated = Date.parse(issue.updated_on);
    // Keep anything with an unreadable timestamp; the count cap still bounds it.
    return Number.isNaN(updated) || updated >= cutoff;
  });

  if (kept.length <= maxCount) return Object.fromEntries(kept);

  // Over the cap: keep pinned plus the most recently updated.
  const pinnedEntries = kept.filter(([id]) => pinned.has(id));
  const rest = kept
    .filter(([id]) => !pinned.has(id))
    .sort(([, a], [, b]) => Date.parse(b.updated_on) - Date.parse(a.updated_on))
    .slice(0, Math.max(0, maxCount - pinnedEntries.length));

  return Object.fromEntries([...pinnedEntries, ...rest]);
}

/** Badge text for a count, matching v1's "99+" cap. */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}
