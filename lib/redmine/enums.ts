import type { RedmineClient } from './client';
import type { Enumeration, IssueStatus, Tracker } from './types';

/**
 * Redmine's enumeration endpoints are unpaginated — they return the full list.
 *
 * Note `/trackers.json` is global. v1 read trackers per project via
 * `include=trackers`, which meant the tracker dropdown was empty until the
 * project detail happened to have been fetched.
 */

export async function listIssueStatuses(
  client: RedmineClient,
  signal?: AbortSignal,
): Promise<IssueStatus[]> {
  const body = await client.get<{ issue_statuses: IssueStatus[] }>('/issue_statuses.json', {}, signal);
  return body.issue_statuses ?? [];
}

export async function listTrackers(client: RedmineClient, signal?: AbortSignal): Promise<Tracker[]> {
  const body = await client.get<{ trackers: Tracker[] }>('/trackers.json', {}, signal);
  return body.trackers ?? [];
}

/**
 * Works fine on current Redmine. v1's `getPriorities()` opened with a bare
 * `return;` and the comment "Now not working in Redmine", so priority was never
 * editable.
 */
export async function listIssuePriorities(
  client: RedmineClient,
  signal?: AbortSignal,
): Promise<Enumeration[]> {
  const body = await client.get<{ issue_priorities: Enumeration[] }>(
    '/enumerations/issue_priorities.json',
    {},
    signal,
  );
  return body.issue_priorities ?? [];
}

export async function listTimeEntryActivities(
  client: RedmineClient,
  signal?: AbortSignal,
): Promise<Enumeration[]> {
  const body = await client.get<{ time_entry_activities: Enumeration[] }>(
    '/enumerations/time_entry_activities.json',
    {},
    signal,
  );
  return body.time_entry_activities ?? [];
}
