import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { Issue } from '@/lib/redmine';
import { DEFAULT_SYNC_META } from '@/lib/store/defaults';
import {
  enumsItem,
  issuesItem,
  prefsItem,
  readStateItem,
  secretsItem,
  syncMetaItem,
  timerItem,
} from '@/lib/store/items';
import type { SyncMeta } from '@/lib/store/types';

import { backoffMinutes, nextPollFloor, runPoll, shouldSkipPoll } from './poller';

describe('backoffMinutes', () => {
  it('does not back off while healthy', () => {
    expect(backoffMinutes(0, 5)).toBe(0);
  });

  it('doubles per consecutive failure', () => {
    expect(backoffMinutes(1, 5)).toBe(5);
    expect(backoffMinutes(2, 5)).toBe(10);
    expect(backoffMinutes(3, 5)).toBe(20);
  });

  it('caps at an hour', () => {
    expect(backoffMinutes(50, 5)).toBe(60);
  });
});

describe('shouldSkipPoll', () => {
  const meta = (over: Partial<SyncMeta>): SyncMeta => ({ ...DEFAULT_SYNC_META, ...over });

  it('never skips while healthy', () => {
    expect(shouldSkipPoll(meta({}), new Date(), 5)).toBe(false);
  });

  it('skips inside the backoff window', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    const state = meta({ consecutiveFailures: 2, lastAttemptAt: '2026-09-01T11:55:00Z' });
    expect(shouldSkipPoll(state, now, 5)).toBe(true); // 10 minute window
  });

  it('polls again once the window passes', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    const state = meta({ consecutiveFailures: 2, lastAttemptAt: '2026-09-01T11:40:00Z' });
    expect(shouldSkipPoll(state, now, 5)).toBe(false);
  });
});

describe('nextPollFloor', () => {
  const issue = (id: number, updated: string) => ({ id, updated_on: updated }) as Issue;

  it('advances to the newest server timestamp', () => {
    expect(
      nextPollFloor('2026-09-01T10:00:00Z', [
        issue(1, '2026-09-01T11:00:00Z'),
        issue(2, '2026-09-01T12:00:00Z'),
      ]),
    ).toBe('2026-09-01T12:00:00Z');
  });

  it('holds the previous floor when nothing came back', () => {
    expect(nextPollFloor('2026-09-01T10:00:00Z', [])).toBe('2026-09-01T10:00:00Z');
  });

  it('never moves backwards', () => {
    expect(
      nextPollFloor('2026-09-01T12:00:00Z', [issue(1, '2026-09-01T09:00:00Z')]),
    ).toBe('2026-09-01T12:00:00Z');
  });

  it('starts from nothing on the first run', () => {
    expect(nextPollFloor(null, [issue(1, '2026-09-01T09:00:00Z')])).toBe('2026-09-01T09:00:00Z');
  });
});

describe('runPoll', () => {
  const HOST = 'https://redmine.test';

  function issue(id: number, updated: string, assigned = true): Issue {
    return {
      id,
      subject: `Issue ${id}`,
      updated_on: updated,
      created_on: updated,
      description: '',
      done_ratio: 0,
      project: { id: 1, name: 'P' },
      tracker: { id: 1, name: 'Bug' },
      status: { id: 1, name: 'New' },
      priority: { id: 2, name: 'Normal' },
      author: { id: 1, name: 'A' },
      assigned_to: assigned ? { id: 1, name: 'Me' } : undefined,
    } as Issue;
  }

  /** Routes by the filter field present in the query string. */
  function stubApi(options: { assigned?: Issue[]; watched?: Issue[] } = {}) {
    const requests: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requests.push(url);
        const json = (body: unknown) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });

        if (url.includes('/issues.json')) {
          const watched = url.includes('watcher_id');
          const issues = (watched ? options.watched : options.assigned) ?? [];
          return json({ issues, total_count: issues.length, offset: 0, limit: 100 });
        }
        if (url.includes('/issue_statuses.json')) return json({ issue_statuses: [{ id: 1, name: 'New' }] });
        if (url.includes('/trackers.json')) return json({ trackers: [{ id: 1, name: 'Bug' }] });
        if (url.includes('issue_priorities')) return json({ issue_priorities: [{ id: 2, name: 'Normal' }] });
        if (url.includes('time_entry_activities')) return json({ time_entry_activities: [{ id: 9, name: 'Dev' }] });
        return json({});
      }),
    );

    return { requests };
  }

  /**
   * fake-browser does not implement the permissions API, and the poller treats a
   * throw as "not granted" — so grant (or deny) it explicitly. The cast is
   * needed because the stub resolves `contains` to its callback overload, whose
   * return type is `void` rather than `Promise<boolean>`.
   */
  const grantHostPermission = (granted: boolean) =>
    vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(granted as never);

  beforeEach(async () => {
    fakeBrowser.reset();
    vi.unstubAllGlobals();
    grantHostPermission(true);
    await prefsItem.setValue({ ...(await prefsItem.getValue()), host: HOST });
    await secretsItem.setValue({ apiKey: 'key', httpPassword: '' });
  });

  it('reports unconfigured when there is no host or key', async () => {
    await secretsItem.setValue({ apiKey: '', httpPassword: '' });
    expect(await runPoll()).toEqual({ status: 'unconfigured' });
  });

  it('reports no-permission when the origin has not been granted', async () => {
    grantHostPermission(false);
    stubApi();

    const outcome = await runPoll();
    expect(outcome.status).toBe('no-permission');
    expect((await syncMetaItem.getValue()).lastErrorKind).toBe('permission');
  });

  it('backfills on first run and records the floor from server timestamps', async () => {
    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z'), issue(2, '2026-09-01T12:00:00Z')] });

    const outcome = await runPoll();
    expect(outcome).toMatchObject({ status: 'ok', fetched: 2, created: 2 });

    const meta = await syncMetaItem.getValue();
    expect(meta.backfilledAt).not.toBeNull();
    expect(meta.lastPolledAt).toBe('2026-09-01T12:00:00Z');
    expect(Object.keys(await issuesItem.getValue())).toHaveLength(2);
  });

  it('sends no updated_on filter on the backfill, but does on later polls', async () => {
    const { requests } = stubApi({ assigned: [issue(1, '2026-09-01T12:00:00Z')] });

    await runPoll();
    // Check the filter key specifically — `sort=updated_on:desc` is always
    // present and would match a looser substring test.
    expect(requests.some((url) => decodeURIComponent(url).includes('v[updated_on][]'))).toBe(false);

    requests.length = 0;
    await runPoll({ force: true });

    const issueRequests = requests.filter((url) => url.includes('/issues.json'));
    expect(issueRequests.length).toBe(2);
    for (const url of issueRequests) {
      expect(decodeURIComponent(url)).toContain('v[updated_on][]=2026-09-01T12:00:00Z');
    }
  });

  it('de-duplicates issues that are both assigned and watched', async () => {
    const shared = issue(1, '2026-09-01T10:00:00Z');
    stubApi({ assigned: [shared], watched: [shared, issue(2, '2026-09-01T11:00:00Z')] });

    const outcome = await runPoll();
    expect(outcome.fetched).toBe(2);
  });

  it('counts every backfilled issue as unread and sets the badge', async () => {
    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z'), issue(2, '2026-09-01T11:00:00Z')] });
    const setBadge = vi.spyOn(fakeBrowser.action, 'setBadgeText');

    const outcome = await runPoll();
    expect(outcome.unread).toBe(2);
    expect(setBadge).toHaveBeenCalledWith({ text: '2' });
  });

  it('does not notify for the backfill', async () => {
    await prefsItem.setValue({
      ...(await prefsItem.getValue()),
      notifications: { mode: 'updated' },
    });
    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z')] });
    const notify = vi.spyOn(fakeBrowser.notifications, 'create');

    await runPoll();
    // Every issue is "new" on first run; announcing them all is noise.
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifies about changes on a subsequent poll', async () => {
    await prefsItem.setValue({
      ...(await prefsItem.getValue()),
      notifications: { mode: 'updated' },
    });
    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z')] });
    await runPoll();

    const notify = vi.spyOn(fakeBrowser.notifications, 'create');
    stubApi({ assigned: [issue(1, '2026-09-02T10:00:00Z')] });
    await runPoll({ force: true });

    expect(notify).toHaveBeenCalledOnce();
  });

  it('stays silent when notifications are off', async () => {
    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z')] });
    await runPoll();

    const notify = vi.spyOn(fakeBrowser.notifications, 'create');
    stubApi({ assigned: [issue(1, '2026-09-02T10:00:00Z')] });
    await runPoll({ force: true });

    expect(notify).not.toHaveBeenCalled();
  });

  it('caches enumerations, including priorities', async () => {
    stubApi({ assigned: [] });
    await runPoll();

    const enums = await enumsItem.getValue();
    expect(enums.statuses).toHaveLength(1);
    expect(enums.priorities).toHaveLength(1);
    expect(enums.activities).toHaveLength(1);
  });

  it('records the failure and backs off when Redmine rejects the key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );

    const outcome = await runPoll();
    expect(outcome.status).toBe('error');

    const meta = await syncMetaItem.getValue();
    expect(meta.lastErrorKind).toBe('unauthorized');
    expect(meta.consecutiveFailures).toBe(1);

    // The next scheduled poll is suppressed rather than hammering the server.
    expect(await runPoll()).toEqual({ status: 'skipped' });
  });

  it('clears the failure state after a recovery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    await runPoll();
    expect((await syncMetaItem.getValue()).consecutiveFailures).toBe(1);

    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z')] });
    await runPoll({ force: true });

    const meta = await syncMetaItem.getValue();
    expect(meta.consecutiveFailures).toBe(0);
    expect(meta.lastErrorKind).toBeNull();
  });

  it('preserves read state across polls', async () => {
    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z')] });
    await runPoll();

    await readStateItem.setValue({ '1': '2026-09-01T11:00:00Z' });

    stubApi({ assigned: [issue(1, '2026-09-01T10:00:00Z')] });
    const outcome = await runPoll({ force: true });

    // Re-fetching an unchanged issue must not resurrect it as unread (D3).
    expect(outcome.unread).toBe(0);
  });

  it('never evicts an issue with a running timer', async () => {
    const ancient = issue(1, '2020-01-01T00:00:00Z');
    await timerItem.setValue({ issueId: 1, issueSubject: 'Issue 1', startedAt: '2026-09-01T09:00:00Z' });
    stubApi({ assigned: [ancient] });

    await runPoll();
    expect(Object.keys(await issuesItem.getValue())).toContain('1');
  });
});
