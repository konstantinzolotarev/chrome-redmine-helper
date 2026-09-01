import type { QueryParams, RedmineClient } from './client';
import { type FilterOperator, type QueryFilter, toFilterParams } from './filters';
import type { Issue, PagedResponse, UploadRef } from './types';

/**
 * `me` is resolved server-side by Redmine, which removes v1's bootstrap step of
 * fetching /users/current.json purely to learn an id before it could poll.
 */
export const ME = 'me';

export interface IssueFilters {
  assignedToMe?: boolean;
  watchedByMe?: boolean;
  /** Restrict to these projects; empty or omitted means all visible projects. */
  projectIds?: number[];
  /**
   * Which statuses to include. Defaults to `open`, matching what a user expects
   * from an issue list — note this must be set explicitly, because Redmine's
   * `f[]` mode would otherwise return closed issues too.
   */
  status?: 'open' | 'closed' | 'all';
  /** Only issues touched at or after this instant — the delta-poll workhorse. */
  updatedSince?: Date | string;
  /** Substring match on subject. */
  subject?: string;
  sort?: string;
}

/**
 * Format an instant the way Redmine's date/time filters accept.
 *
 * `Date#toISOString()` always emits milliseconds, and Redmine rejects them
 * outright with `422 {"errors":["Updated is invalid"]}` — so the delta poll
 * fails on every call unless they are stripped.
 */
export function toRedmineTimestamp(value: Date | string): string {
  if (typeof value === 'string') return value;
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function toIssueParams(filters: IssueFilters = {}): QueryParams {
  const queryFilters: QueryFilter[] = [];

  if (filters.assignedToMe) {
    queryFilters.push({ field: 'assigned_to_id', operator: '=', values: [ME] });
  }
  if (filters.watchedByMe) {
    queryFilters.push({ field: 'watcher_id', operator: '=', values: [ME] });
  }
  if (filters.projectIds && filters.projectIds.length > 0) {
    queryFilters.push({ field: 'project_id', operator: '=', values: filters.projectIds });
  }
  if (filters.updatedSince) {
    queryFilters.push({
      field: 'updated_on',
      operator: '>=',
      values: [toRedmineTimestamp(filters.updatedSince)],
    });
  }
  if (filters.subject) {
    queryFilters.push({ field: 'subject', operator: '~', values: [filters.subject] });
  }

  // Always explicit — see the note on default scope in filters.ts.
  const statusOperator: FilterOperator =
    filters.status === 'all' ? '*' : filters.status === 'closed' ? 'c' : 'o';
  queryFilters.push({ field: 'status_id', operator: statusOperator });

  return {
    ...toFilterParams(queryFilters),
    sort: filters.sort ?? 'updated_on:desc',
  };
}

export function listIssues(
  client: RedmineClient,
  filters: IssueFilters = {},
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<Issue[]> {
  return client.collect<Issue>('/issues.json', 'issues', toIssueParams(filters), options);
}

/** Default includes cover everything the detail pane renders. */
export async function getIssue(
  client: RedmineClient,
  id: number,
  include = 'journals,attachments,relations',
  signal?: AbortSignal,
): Promise<Issue> {
  const body = await client.get<{ issue: Issue }>(`/issues/${id}.json`, { include }, signal);
  return body.issue;
}

export interface IssueWrite {
  project_id?: number;
  tracker_id?: number;
  status_id?: number;
  priority_id?: number;
  subject?: string;
  description?: string;
  category_id?: number;
  fixed_version_id?: number;
  assigned_to_id?: number | null;
  parent_issue_id?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_hours?: number | null;
  done_ratio?: number;
  /** Appended as a journal entry rather than overwriting the description. */
  notes?: string;
  private_notes?: boolean;
  uploads?: UploadRef[];
  custom_fields?: Array<{ id: number; value: string | string[] }>;
}

export async function createIssue(
  client: RedmineClient,
  issue: IssueWrite,
  signal?: AbortSignal,
): Promise<Issue> {
  const body = await client.post<{ issue: Issue }>('/issues.json', { issue }, signal);
  return body.issue;
}

/** Redmine answers 204 with no body, so there is nothing useful to return. */
export function updateIssue(
  client: RedmineClient,
  id: number,
  issue: IssueWrite,
  signal?: AbortSignal,
): Promise<void> {
  return client.put<void>(`/issues/${id}.json`, { issue }, signal);
}

export function deleteIssue(client: RedmineClient, id: number, signal?: AbortSignal): Promise<void> {
  return client.delete<void>(`/issues/${id}.json`, signal);
}

export function addComment(
  client: RedmineClient,
  id: number,
  notes: string,
  signal?: AbortSignal,
): Promise<void> {
  return updateIssue(client, id, { notes }, signal);
}

export function addWatcher(
  client: RedmineClient,
  issueId: number,
  userId: number,
  signal?: AbortSignal,
): Promise<void> {
  return client.post<void>(`/issues/${issueId}/watchers.json`, { user_id: userId }, signal);
}

export function removeWatcher(
  client: RedmineClient,
  issueId: number,
  userId: number,
  signal?: AbortSignal,
): Promise<void> {
  return client.delete<void>(`/issues/${issueId}/watchers/${userId}.json`, signal);
}

/** Total matching issues without transferring any — used to size a backfill. */
export async function countIssues(
  client: RedmineClient,
  filters: IssueFilters = {},
  signal?: AbortSignal,
): Promise<number> {
  const page = await client.get<PagedResponse>(
    '/issues.json',
    { ...toIssueParams(filters), limit: 1 },
    signal,
  );
  return page.total_count ?? 0;
}
