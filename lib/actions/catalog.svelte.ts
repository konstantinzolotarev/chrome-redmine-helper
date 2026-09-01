import { currentClient } from '@/lib/client.svelte';
import { isRedmineError, listNews, listProjects, type NewsItem } from '@/lib/redmine';
import { projects } from '@/lib/store/app.svelte';
import { toast } from '@/lib/store/ui.svelte';

function describe(error: unknown): string {
  return isRedmineError(error) ? error.describe() : String(error);
}

export async function refreshProjects(): Promise<void> {
  const client = currentClient();
  if (!client) return;

  try {
    const list = await listProjects(client);
    await projects.set(Object.fromEntries(list.map((project) => [String(project.id), project])));
  } catch (error) {
    toast.show('error', describe(error));
  }
}

/** News is read on demand rather than cached — it is a small, rarely-used list. */
export async function fetchNews(): Promise<NewsItem[]> {
  const client = currentClient();
  if (!client) return [];

  try {
    return await listNews(client, undefined, { maxItems: 50 });
  } catch (error) {
    toast.show('error', describe(error));
    return [];
  }
}
