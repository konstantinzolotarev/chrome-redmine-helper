import type { RedmineClient } from './client';
import type { Membership, Project } from './types';

export function listProjects(
  client: RedmineClient,
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<Project[]> {
  return client.collect<Project>('/projects.json', 'projects', {}, options);
}

export async function getProject(
  client: RedmineClient,
  id: number | string,
  include = 'trackers,issue_categories',
  signal?: AbortSignal,
): Promise<Project> {
  const body = await client.get<{ project: Project }>(`/projects/${id}.json`, { include }, signal);
  return body.project;
}

/**
 * Project members, used to populate assignee dropdowns.
 *
 * Requires view_members permission; a 403 here is normal for non-managers and
 * callers should fall back to the users they have already seen on issues.
 */
export function listMemberships(
  client: RedmineClient,
  projectId: number | string,
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<Membership[]> {
  return client.collect<Membership>(
    `/projects/${projectId}/memberships.json`,
    'memberships',
    {},
    options,
  );
}
