// @vitest-environment node
//
// Pinned to node: the suite default is happy-dom for component tests, and its
// fetch cannot reach the live dev Redmine — which made every test here skip
// silently rather than fail.

/**
 * Integration tests against a real Redmine.
 *
 * Skipped automatically unless a dev instance is reachable, so `npm test` stays
 * green without Docker. To run them:
 *
 *   docker compose -f dev/docker-compose.yml up -d
 *   docker compose -f dev/docker-compose.yml exec redmine rails runner /dev-scripts/seed.rb
 *   npm test
 *
 * Override the target with REDMINE_URL / REDMINE_API_KEY.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { RedmineClient } from './client';
import { listIssueStatuses, listIssuePriorities, listTimeEntryActivities, listTrackers } from './enums';
import { RedmineError } from './errors';
import { addComment, createIssue, getIssue, listIssues, updateIssue } from './issues';
import { listProjects } from './projects';
import { createTimeEntry } from './time-entries';
import { getCurrentUser } from './users';

const HOST = process.env.REDMINE_URL ?? 'http://localhost:3001';

function readKey(): string {
  if (process.env.REDMINE_API_KEY) return process.env.REDMINE_API_KEY;
  try {
    return readFileSync(new URL('../../dev/.api-key', import.meta.url), 'utf8').trim();
  } catch {
    return '';
  }
}

const API_KEY = readKey();

async function reachable(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    const res = await fetch(`${HOST}/users/current.json`, {
      headers: { 'X-Redmine-API-Key': API_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const LIVE = await reachable();

describe.skipIf(!LIVE)('RedmineClient against a live Redmine', () => {
  const client = new RedmineClient({ host: HOST, apiKey: API_KEY });
  let projectIds: number[] = [];

  beforeAll(async () => {
    projectIds = (await listProjects(client)).map((p) => p.id);
  });

  it('authenticates and identifies the current user', async () => {
    const user = await getCurrentUser(client);
    expect(user.id).toBeGreaterThan(0);
    expect(user.login).toBe('admin');
  });

  it('resolves assigned_to_id=me server-side', async () => {
    const issues = await listIssues(client, { assignedToMe: true, status: 'all' });
    expect(issues.length).toBeGreaterThan(0);
    const me = await getCurrentUser(client);
    for (const issue of issues) expect(issue.assigned_to?.id).toBe(me.id);
  });

  it('defaults to open issues and widens on request', async () => {
    const open = await listIssues(client, { assignedToMe: true });
    const all = await listIssues(client, { assignedToMe: true, status: 'all' });
    const closed = await listIssues(client, { assignedToMe: true, status: 'closed' });

    expect(all.length).toBe(open.length + closed.length);
    expect(all.length).toBeGreaterThan(open.length);
  });

  it('filters by multiple projects without dropping the assignee filter', async () => {
    // The regression this guards: mixing shorthand params with f[] syntax makes
    // Redmine ignore the shorthand, returning every issue in those projects.
    const mine = await listIssues(client, { assignedToMe: true, status: 'all' });
    const scoped = await listIssues(client, {
      assignedToMe: true,
      status: 'all',
      projectIds,
    });
    expect(scoped.length).toBe(mine.length);

    const first = await listIssues(client, {
      assignedToMe: true,
      status: 'all',
      projectIds: [projectIds[0]!],
    });
    expect(first.length).toBeLessThan(mine.length);
    for (const issue of first) expect(issue.project.id).toBe(projectIds[0]);
  });

  it('supports the delta poll via updated_on', async () => {
    const future = await listIssues(client, {
      assignedToMe: true,
      status: 'all',
      updatedSince: new Date(Date.now() + 86_400_000),
    });
    expect(future).toHaveLength(0);

    const past = await listIssues(client, {
      assignedToMe: true,
      status: 'all',
      updatedSince: new Date(Date.now() - 30 * 86_400_000),
    });
    expect(past.length).toBeGreaterThan(0);
  });

  it('finds watched issues', async () => {
    const watched = await listIssues(client, { watchedByMe: true, status: 'all' });
    expect(watched.length).toBeGreaterThan(0);
  });

  it('paginates across pages and honours maxItems', async () => {
    const all = await listIssues(client, { status: 'all' });
    const paged = await client.collect('/issues.json', 'issues', {
      ...(await import('./issues')).toIssueParams({ status: 'all' }),
    }, { pageSize: 2 });
    expect(paged.length).toBe(all.length);

    const capped = await client.collect('/issues.json', 'issues', {}, { pageSize: 2, maxItems: 3 });
    expect(capped).toHaveLength(3);
  });

  it('loads every enumeration, including priorities', async () => {
    // v1 disabled priorities entirely with the comment "Now not working in Redmine".
    const [statuses, trackers, priorities, activities] = await Promise.all([
      listIssueStatuses(client),
      listTrackers(client),
      listIssuePriorities(client),
      listTimeEntryActivities(client),
    ]);

    expect(statuses.length).toBeGreaterThan(0);
    expect(trackers.length).toBeGreaterThan(0);
    expect(priorities.length).toBeGreaterThan(0);
    expect(activities.length).toBeGreaterThan(0);
  });

  it('reads an issue with journals', async () => {
    const [first] = await listIssues(client, { status: 'all' });
    const issue = await getIssue(client, first!.id);
    expect(issue.journals).toBeDefined();
    expect(issue.journals!.length).toBeGreaterThan(0);
  });

  it('creates, updates and comments on an issue', async () => {
    const trackers = await listTrackers(client);
    const created = await createIssue(client, {
      project_id: projectIds[0]!,
      tracker_id: trackers[0]!.id,
      subject: 'Integration test issue',
      description: 'Created by the extension test suite.',
    });
    expect(created.id).toBeGreaterThan(0);

    await updateIssue(client, created.id, { done_ratio: 40, subject: 'Integration test issue (edited)' });
    await addComment(client, created.id, 'A comment from the test suite.');

    const reloaded = await getIssue(client, created.id);
    expect(reloaded.done_ratio).toBe(40);
    expect(reloaded.subject).toBe('Integration test issue (edited)');
    expect(reloaded.journals!.some((j) => j.notes.includes('test suite'))).toBe(true);
  });

  it('logs a time entry', async () => {
    const [issue] = await listIssues(client, { status: 'all' });
    const activities = await listTimeEntryActivities(client);
    const entry = await createTimeEntry(client, {
      issue_id: issue!.id,
      hours: 0.25,
      activity_id: activities[0]!.id,
      comments: 'Logged by the test suite',
    });
    expect(entry.hours).toBe(0.25);
  });

  it('maps a bad API key to `unauthorized`', async () => {
    const bad = new RedmineClient({ host: HOST, apiKey: 'definitely-not-a-valid-key' });
    await expect(getCurrentUser(bad)).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('maps a missing resource to `not_found`', async () => {
    await expect(getIssue(client, 99_999_999)).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('maps a rejected payload to `validation` with messages', async () => {
    // Missing the required subject.
    const error = await createIssue(client, { project_id: projectIds[0]! }).catch((e) => e);
    expect(error).toBeInstanceOf(RedmineError);
    expect(error.kind).toBe('validation');
    expect(error.errors.length).toBeGreaterThan(0);
  });

  it('maps an unreachable host to `network`', async () => {
    const offline = new RedmineClient(
      { host: 'http://127.0.0.1:9', apiKey: API_KEY },
      { timeoutMs: 2000 },
    );
    await expect(getCurrentUser(offline)).rejects.toMatchObject({ kind: 'network' });
  });
});
