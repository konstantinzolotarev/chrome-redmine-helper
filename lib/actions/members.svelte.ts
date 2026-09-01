import { currentClient } from '@/lib/client.svelte';
import { listMemberships } from '@/lib/redmine';
import { members } from '@/lib/store/app.svelte';

/**
 * Load a project's assignable users.
 *
 * A 403 is normal here — `view_members` is not granted to every role — so the
 * failure is swallowed and the assignee picker simply stays unavailable rather
 * than showing an error the user cannot act on.
 */
export async function loadMembers(projectId: number): Promise<void> {
  if (members.current[String(projectId)]) return;

  const client = currentClient();
  if (!client) return;

  try {
    const memberships = await listMemberships(client, projectId);
    const users = memberships
      .map((membership) => membership.user)
      .filter((user): user is { id: number; name: string } => Boolean(user));

    await members.update((cache) => ({ ...cache, [String(projectId)]: users }));
  } catch {
    await members.update((cache) => ({ ...cache, [String(projectId)]: [] }));
  }
}
