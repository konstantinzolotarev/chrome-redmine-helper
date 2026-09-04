import { currentClient } from '@/lib/client.svelte';
import { addWatcher, isRedmineError, removeWatcher } from '@/lib/redmine';
import { currentUser, issues } from '@/lib/store/app.svelte';
import { toast } from '@/lib/store/ui.svelte';

/**
 * Add or remove the current user from an issue's watchers.
 *
 * Only meaningful once a detail fetch has brought the real list: Redmine omits
 * `watchers` from users without `view_issue_watchers`, and toggling blind would
 * mean guessing which of add/remove to send. Callers hide the control in that
 * case, and this returns early as a second line of defence.
 */
export async function toggleWatch(issueId: number): Promise<boolean> {
  const client = currentClient();
  const me = currentUser.current;
  if (!client || !me) return false;

  const watchers = issues.current[String(issueId)]?.watchers;
  if (!watchers) return false;

  const watching = watchers.some((watcher) => watcher.id === me.id);

  try {
    if (watching) {
      await removeWatcher(client, issueId, me.id);
    } else {
      await addWatcher(client, issueId, me.id);
    }
  } catch (error) {
    toast.show('error', isRedmineError(error) ? error.describe() : String(error));
    return false;
  }

  // Written only after the request succeeds: an optimistic flip that failed
  // would leave the eye disagreeing with Redmine until the next detail fetch.
  const next = watching
    ? watchers.filter((watcher) => watcher.id !== me.id)
    : [...watchers, { id: me.id, name: me.name }];

  await issues.update((cache) => {
    const issue = cache[String(issueId)];
    return issue ? { ...cache, [String(issueId)]: { ...issue, watchers: next } } : cache;
  });

  return true;
}
