import type { Issue } from '@/lib/redmine';

import { countUnread, markAllRead, markRead, markUnread } from './derive';
import {
  currentUserItem,
  enumsItem,
  issuesItem,
  membersItem,
  prefsItem,
  projectsItem,
  readStateItem,
  secretsItem,
  syncMetaItem,
  timerItem,
  unsentSessionsItem,
} from './items';
import { reactiveStorage } from './reactive.svelte';

/**
 * The shared reactive view of storage.
 *
 * Imported by the side panel, the tab page and options alike; each gets the same
 * data and stays in step with the others automatically. The service worker
 * deliberately does *not* import this module — it reads and writes the raw
 * storage items in `items.ts`, keeping the Svelte runtime out of the worker.
 */

export const prefs = reactiveStorage(prefsItem);
export const secrets = reactiveStorage(secretsItem);
export const issues = reactiveStorage(issuesItem);
export const readState = reactiveStorage(readStateItem);
export const projects = reactiveStorage(projectsItem);
export const enums = reactiveStorage(enumsItem);
export const members = reactiveStorage(membersItem);
export const syncMeta = reactiveStorage(syncMetaItem);
export const currentUser = reactiveStorage(currentUserItem);
export const timer = reactiveStorage(timerItem);
export const unsentSessions = reactiveStorage(unsentSessionsItem);

/** Every cached issue, newest activity first. */
export function allIssues(): Issue[] {
  return Object.values(issues.current).sort(
    (a, b) => Date.parse(b.updated_on) - Date.parse(a.updated_on),
  );
}

export function unreadCount(): number {
  return countUnread(Object.values(issues.current), readState.current);
}

export function getIssue(id: number): Issue | undefined {
  return issues.current[String(id)];
}

export async function markIssueRead(id: number): Promise<void> {
  await readState.update((current) => markRead(current, id));
}

export async function markIssueUnread(id: number): Promise<void> {
  await readState.update((current) => markUnread(current, id));
}

export async function markAllIssuesRead(): Promise<void> {
  const list = Object.values(issues.current);
  await readState.update((current) => markAllRead(current, list));
}

/** True once the connection details needed to talk to Redmine are present. */
export function isConfigured(): boolean {
  return prefs.current.host !== '' && secrets.current.apiKey !== '';
}

/**
 * True when the user watches this issue.
 *
 * A detail fetch brings the real watcher list, and that is used when present.
 * Otherwise this falls back to an inference: every cached issue arrived via
 * `assigned_to_id=me` or `watcher_id=me`, so "not assigned to me" means it can
 * only have come from the watcher query. That inference is wrong for an issue
 * both assigned to and watched by the user — which is exactly the case the
 * real list corrects once it has been loaded.
 */
export function isWatched(issue: Issue): boolean {
  const me = currentUser.current;
  if (!me) return false;
  if (issue.watchers) return issue.watchers.some((watcher) => watcher.id === me.id);
  return issue.assigned_to?.id !== me.id;
}
