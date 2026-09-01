import { currentClient } from '@/lib/client.svelte';
import {
  addComment,
  createIssue,
  getIssue,
  isRedmineError,
  updateIssue,
  type Issue,
  type IssueWrite,
} from '@/lib/redmine';
import { issues, markIssueRead } from '@/lib/store/app.svelte';
import { mergeIssue } from '@/lib/store/derive';
import { toast } from '@/lib/store/ui.svelte';

function describe(error: unknown): string {
  return isRedmineError(error) ? error.describe() : String(error);
}

async function writeToCache(issue: Issue): Promise<void> {
  await issues.update((cache) => ({
    ...cache,
    [String(issue.id)]: mergeIssue(cache[String(issue.id)], issue),
  }));
}

/** Patch one issue in the cache, returning what was there before. */
async function patchCache(id: number, patch: Partial<Issue>): Promise<Issue | undefined> {
  let previous: Issue | undefined;
  await issues.update((cache) => {
    previous = cache[String(id)];
    if (!previous) return cache;
    return { ...cache, [String(id)]: { ...previous, ...patch } };
  });
  return previous;
}

/**
 * Apply a field change optimistically, rolling back if Redmine rejects it.
 *
 * `optimistic` is what the UI should show immediately; `write` is the payload
 * Redmine needs. They differ because the API takes ids while the cache holds
 * `{id, name}` pairs.
 */
export async function applyIssueChange(
  id: number,
  write: IssueWrite,
  optimistic: Partial<Issue>,
): Promise<boolean> {
  const client = currentClient();
  if (!client) {
    toast.show('error', 'Not connected to Redmine yet.');
    return false;
  }

  const previous = await patchCache(id, optimistic);

  try {
    await updateIssue(client, id, write);
    // Re-read so journals and derived fields (spent time, closed_on) are right.
    await writeToCache(await getIssue(client, id));
    return true;
  } catch (error) {
    if (previous) await patchCache(id, previous);
    toast.show('error', describe(error));
    return false;
  }
}

export async function postComment(id: number, notes: string): Promise<boolean> {
  const client = currentClient();
  if (!client) {
    toast.show('error', 'Not connected to Redmine yet.');
    return false;
  }

  try {
    await addComment(client, id, notes);
    await writeToCache(await getIssue(client, id));
    // The user has just read and replied; do not leave it marked unread.
    await markIssueRead(id);
    return true;
  } catch (error) {
    toast.show('error', describe(error));
    return false;
  }
}

/** Fetch the full issue (journals, attachments, relations) into the cache. */
export async function loadIssueDetail(id: number): Promise<void> {
  const client = currentClient();
  if (!client) return;

  try {
    await writeToCache(await getIssue(client, id));
  } catch (error) {
    toast.show('error', describe(error));
  }
}

/** Create an issue and put it straight into the cache. */
export async function createNewIssue(write: IssueWrite): Promise<Issue | null> {
  const client = currentClient();
  if (!client) {
    toast.show('error', 'Not connected to Redmine yet.');
    return null;
  }

  try {
    const created = await createIssue(client, write);
    await writeToCache(created);
    toast.show('success', `Created #${created.id}.`);
    return created;
  } catch (error) {
    toast.show('error', describe(error));
    return null;
  }
}
