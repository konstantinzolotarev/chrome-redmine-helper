<script lang="ts">
  import { Book, RefreshCw } from 'lucide-svelte';

  import { refreshProjects } from '@/lib/actions/catalog.svelte';
  import { allIssues, prefs, projects } from '@/lib/store/app.svelte';

  import Markup from '../Markup.svelte';
  import Button from '../ui/Button.svelte';

  let refreshing = $state(false);

  const list = $derived(
    Object.values(projects.current).sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Issues we already hold, counted per project — no extra requests. */
  const counts = $derived.by(() => {
    const tally: Record<string, number> = {};
    for (const issue of allIssues()) {
      tally[String(issue.project.id)] = (tally[String(issue.project.id)] ?? 0) + 1;
    }
    return tally;
  });

  async function refresh() {
    refreshing = true;
    try {
      await refreshProjects();
    } finally {
      refreshing = false;
    }
  }
</script>

<div class="flex flex-col gap-3">
  <div class="flex justify-end">
    <Button loading={refreshing} onclick={refresh}>
      {#snippet children()}
        <RefreshCw size={13} />
        Refresh projects
      {/snippet}
    </Button>
  </div>

  {#if list.length === 0}
    <div class="flex flex-col items-center gap-2 rounded-md border border-border p-8 text-text-muted">
      <Book size={22} />
      <p class="text-xs">No projects loaded yet.</p>
    </div>
  {:else}
    <ul class="grid gap-2 sm:grid-cols-2">
      {#each list as project (project.id)}
        <li class="rounded-md border border-border p-3">
          <div class="flex items-baseline justify-between gap-2">
            <a
              href={`${prefs.current.host}/projects/${project.identifier}`}
              target="_blank"
              rel="noopener noreferrer"
              class="truncate text-sm font-medium hover:text-accent hover:underline"
              >{project.name}</a
            >
            <span class="shrink-0 text-[11px] text-text-muted">
              {counts[String(project.id)] ?? 0} cached
            </span>
          </div>
          {#if project.description}
            <p class="mt-1 line-clamp-3 text-xs text-text-muted">
              <Markup text={project.description} host={prefs.current.host} />
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
