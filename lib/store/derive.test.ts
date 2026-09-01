import { describe, expect, it } from 'vitest';

import type { Issue } from '@/lib/redmine';

import {
  badgeText,
  countUnread,
  isUnread,
  markAllRead,
  markRead,
  markUnread,
  mergeIssue,
  mergeIssues,
  pruneIssues,
  pruneReadState,
  unreadIssues,
} from './derive';
import type { IssueCache, ReadState } from './types';

function issue(id: number, updatedOn: string, extra: Partial<Issue> = {}): Issue {
  return {
    id,
    updated_on: updatedOn,
    created_on: updatedOn,
    subject: `Issue ${id}`,
    description: '',
    done_ratio: 0,
    project: { id: 1, name: 'P' },
    tracker: { id: 1, name: 'Bug' },
    status: { id: 1, name: 'New' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 1, name: 'A' },
    ...extra,
  } as Issue;
}

describe('isUnread', () => {
  it('treats a never-read issue as unread', () => {
    expect(isUnread(issue(1, '2026-09-01T10:00:00Z'), {})).toBe(true);
  });

  it('treats an issue read after its last update as read', () => {
    const state: ReadState = { '1': '2026-09-01T11:00:00Z' };
    expect(isUnread(issue(1, '2026-09-01T10:00:00Z'), state)).toBe(false);
  });

  it('becomes unread again when the issue is updated after being read', () => {
    const state: ReadState = { '1': '2026-09-01T10:00:00Z' };
    expect(isUnread(issue(1, '2026-09-01T12:00:00Z'), state)).toBe(true);
  });

  it('survives a refetch, unlike v1 mutating a flag onto the issue', () => {
    // The D3 regression: re-fetching an unchanged issue must not resurrect it.
    const state = markRead({}, 1, new Date('2026-09-01T11:00:00Z'));
    const refetched = issue(1, '2026-09-01T10:00:00Z');
    expect(isUnread(refetched, state)).toBe(false);
  });

  it('falls back to unread on an unparseable timestamp', () => {
    expect(isUnread(issue(1, 'not-a-date'), { '1': '2026-09-01T10:00:00Z' })).toBe(true);
    expect(isUnread(issue(1, '2026-09-01T10:00:00Z'), { '1': 'nonsense' })).toBe(true);
  });
});

describe('read state transitions', () => {
  const issues = [
    issue(1, '2026-09-01T10:00:00Z'),
    issue(2, '2026-09-01T11:00:00Z'),
    issue(3, '2026-09-01T12:00:00Z'),
  ];

  it('counts unread without a hand-maintained counter', () => {
    // The D2 regression: the count is derived, so it cannot drift.
    expect(countUnread(issues, {})).toBe(3);

    const afterOne = markRead({}, 2, new Date('2026-09-01T13:00:00Z'));
    expect(countUnread(issues, afterOne)).toBe(2);

    const afterAll = markAllRead({}, issues, new Date('2026-09-01T13:00:00Z'));
    expect(countUnread(issues, afterAll)).toBe(0);
  });

  it('marks a single issue unread again by dropping its entry', () => {
    const state = markAllRead({}, issues, new Date('2026-09-01T13:00:00Z'));
    const next = markUnread(state, 2);

    expect(next['2']).toBeUndefined();
    expect(countUnread(issues, next)).toBe(1);
  });

  it('returns the unread issues themselves', () => {
    const state = markRead({}, 1, new Date('2026-09-01T13:00:00Z'));
    expect(unreadIssues(issues, state).map((i) => i.id)).toEqual([2, 3]);
  });

  it('does not mutate the input state', () => {
    const state: ReadState = { '1': '2026-09-01T10:00:00Z' };
    markRead(state, 2);
    markUnread(state, 1);
    markAllRead(state, issues);
    expect(state).toEqual({ '1': '2026-09-01T10:00:00Z' });
  });

  it('drops read state for issues that left the cache', () => {
    const state: ReadState = { '1': 'x', '2': 'y', '3': 'z' };
    expect(pruneReadState(state, [1, 3])).toEqual({ '1': 'x', '3': 'z' });
  });
});

describe('mergeIssue', () => {
  it('keeps journals when a list refetch omits them', () => {
    const existing = issue(1, '2026-09-01T10:00:00Z', {
      journals: [{ id: 9 }] as Issue['journals'],
    });
    const merged = mergeIssue(existing, issue(1, '2026-09-01T10:00:00Z'));
    expect(merged.journals).toHaveLength(1);
  });

  it('drops stale journals when the issue changed upstream', () => {
    const existing = issue(1, '2026-09-01T10:00:00Z', {
      journals: [{ id: 9 }] as Issue['journals'],
    });
    const merged = mergeIssue(existing, issue(1, '2026-09-01T12:00:00Z'));
    expect(merged.journals).toBeUndefined();
    expect(merged.updated_on).toBe('2026-09-01T12:00:00Z');
  });

  it('prefers journals supplied by a detail fetch', () => {
    const existing = issue(1, '2026-09-01T10:00:00Z', {
      journals: [{ id: 9 }] as Issue['journals'],
    });
    const incoming = issue(1, '2026-09-01T12:00:00Z', {
      journals: [{ id: 10 }, { id: 11 }] as Issue['journals'],
    });
    expect(mergeIssue(existing, incoming).journals).toHaveLength(2);
  });

  it('folds a batch into the cache', () => {
    const cache: IssueCache = { '1': issue(1, '2026-09-01T10:00:00Z') };
    const next = mergeIssues(cache, [issue(1, '2026-09-01T12:00:00Z'), issue(2, '2026-09-01T09:00:00Z')]);

    expect(Object.keys(next).sort()).toEqual(['1', '2']);
    expect(next['1']!.updated_on).toBe('2026-09-01T12:00:00Z');
  });
});

describe('pruneIssues', () => {
  const now = new Date('2026-09-01T00:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  it('evicts issues older than the age cutoff', () => {
    const cache: IssueCache = {
      '1': issue(1, daysAgo(10)),
      '2': issue(2, daysAgo(200)),
    };
    const kept = pruneIssues(cache, { now, maxAgeDays: 90 });
    expect(Object.keys(kept)).toEqual(['1']);
  });

  it('never evicts pinned issues, however old', () => {
    // An issue with a running timer or a queued time entry must survive.
    const cache: IssueCache = {
      '1': issue(1, daysAgo(500)),
      '2': issue(2, daysAgo(500)),
    };
    const kept = pruneIssues(cache, { now, maxAgeDays: 90, pinned: [1] });
    expect(Object.keys(kept)).toEqual(['1']);
  });

  it('caps the cache by count, keeping the most recent', () => {
    const cache: IssueCache = {};
    for (let i = 1; i <= 10; i += 1) cache[String(i)] = issue(i, daysAgo(i));

    const kept = pruneIssues(cache, { now, maxCount: 3 });
    expect(Object.keys(kept).sort((a, b) => Number(a) - Number(b))).toEqual(['1', '2', '3']);
  });

  it('keeps pinned issues even when over the count cap', () => {
    const cache: IssueCache = {};
    for (let i = 1; i <= 10; i += 1) cache[String(i)] = issue(i, daysAgo(i));

    const kept = pruneIssues(cache, { now, maxCount: 3, pinned: [9] });
    expect(Object.keys(kept)).toContain('9');
    expect(Object.keys(kept)).toHaveLength(3);
  });

  it('leaves a small cache untouched', () => {
    const cache: IssueCache = { '1': issue(1, daysAgo(1)) };
    expect(pruneIssues(cache, { now })).toEqual(cache);
  });
});

describe('badgeText', () => {
  it('renders counts, hiding zero and capping at 99+', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(-1)).toBe('');
    expect(badgeText(7)).toBe('7');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });
});
