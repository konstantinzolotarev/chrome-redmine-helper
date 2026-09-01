import type { RedmineClient } from './client';
import type { TimeEntry } from './types';

export interface TimeEntryWrite {
  /** Exactly one of issue_id / project_id is required by Redmine. */
  issue_id?: number;
  project_id?: number;
  spent_on?: string;
  hours: number;
  activity_id?: number;
  comments?: string;
  user_id?: number;
}

export async function createTimeEntry(
  client: RedmineClient,
  entry: TimeEntryWrite,
  signal?: AbortSignal,
): Promise<TimeEntry> {
  const body = await client.post<{ time_entry: TimeEntry }>(
    '/time_entries.json',
    { time_entry: entry },
    signal,
  );
  return body.time_entry;
}

export function listTimeEntries(
  client: RedmineClient,
  filters: { issueId?: number; projectId?: number | string; userId?: number | 'me'; from?: string; to?: string } = {},
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<TimeEntry[]> {
  return client.collect<TimeEntry>(
    '/time_entries.json',
    'time_entries',
    {
      issue_id: filters.issueId,
      project_id: filters.projectId,
      user_id: filters.userId,
      from: filters.from,
      to: filters.to,
    },
    options,
  );
}

export function updateTimeEntry(
  client: RedmineClient,
  id: number,
  entry: Partial<TimeEntryWrite>,
  signal?: AbortSignal,
): Promise<void> {
  return client.put<void>(`/time_entries/${id}.json`, { time_entry: entry }, signal);
}

export function deleteTimeEntry(
  client: RedmineClient,
  id: number,
  signal?: AbortSignal,
): Promise<void> {
  return client.delete<void>(`/time_entries/${id}.json`, signal);
}
