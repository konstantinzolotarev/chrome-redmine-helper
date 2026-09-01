<script lang="ts">
  import { Eye, Search } from 'lucide-svelte';

  import { issueUrl } from '@/lib/format/markup';
  import { allIssues, isWatched, prefs, readState } from '@/lib/store/app.svelte';
  import { isUnread } from '@/lib/store/derive';

  import RelativeTime from '../RelativeTime.svelte';

  let query = $state('');

  const columns = $derived(prefs.current.columns);
  const host = $derived(prefs.current.host);

  const rows = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    const list = allIssues();
    if (!needle) return list;
    return list.filter(
      (issue) => issue.subject.toLowerCase().includes(needle) || String(issue.id).includes(needle),
    );
  });
</script>

<div class="flex flex-col gap-3">
  <div class="flex items-center gap-2">
    <div class="relative w-72">
      <span class="pointer-events-none absolute top-2 left-2 text-text-muted"><Search size={14} /></span>
      <input
        bind:value={query}
        placeholder="Search issues"
        aria-label="Search issues"
        class="w-full rounded-md border border-border bg-bg py-1.5 pr-2 pl-7 text-xs focus:border-accent"
      />
    </div>
    <span class="text-xs text-text-muted">{rows.length} {rows.length === 1 ? 'issue' : 'issues'}</span>
  </div>

  {#if rows.length === 0}
    <p class="rounded-md border border-border p-6 text-center text-xs text-text-muted">
      {query ? 'No issues match that search.' : 'Nothing here yet.'}
    </p>
  {:else}
    <div class="overflow-x-auto rounded-md border border-border">
      <table class="w-full border-collapse text-xs">
        <thead class="bg-surface-2 text-left text-text-muted">
          <tr>
            <th class="w-6 px-2 py-1.5"><span class="sr-only">Unread</span></th>
            {#if columns.id}<th class="px-2 py-1.5 font-medium">#</th>{/if}
            <th class="px-2 py-1.5 font-medium">Subject</th>
            {#if columns.project}<th class="px-2 py-1.5 font-medium">Project</th>{/if}
            {#if columns.tracker}<th class="px-2 py-1.5 font-medium">Tracker</th>{/if}
            {#if columns.status}<th class="px-2 py-1.5 font-medium">Status</th>{/if}
            {#if columns.author}<th class="px-2 py-1.5 font-medium">Author</th>{/if}
            <th class="px-2 py-1.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as issue (issue.id)}
            {@const unread = isUnread(issue, readState.current)}
            <tr class="border-t border-border hover:bg-surface-hover">
              <td class="px-2 py-1.5">
                {#if unread}
                  <span class="block size-1.5 rounded-full bg-unread" aria-label="Unread"></span>
                {/if}
              </td>
              {#if columns.id}
                <td class="px-2 py-1.5 text-text-muted">{issue.id}</td>
              {/if}
              <td class="max-w-md px-2 py-1.5">
                <a
                  href={issueUrl(host, issue.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block truncate hover:text-accent hover:underline {unread ? 'font-semibold' : ''}"
                  >{issue.subject}</a
                >
              </td>
              {#if columns.project}
                <td class="px-2 py-1.5 text-text-muted">{issue.project.name}</td>
              {/if}
              {#if columns.tracker}
                <td class="px-2 py-1.5 text-text-muted">{issue.tracker.name}</td>
              {/if}
              {#if columns.status}
                <td class="px-2 py-1.5 text-text-muted">{issue.status.name}</td>
              {/if}
              {#if columns.author}
                <td class="px-2 py-1.5 text-text-muted">{issue.author?.name ?? '—'}</td>
              {/if}
              <td class="px-2 py-1.5 whitespace-nowrap text-text-muted">
                {#if isWatched(issue)}
                  <span class="mr-1 inline-block align-middle" title="You are watching this issue">
                    <Eye size={11} />
                  </span>
                {/if}
                <RelativeTime value={issue.updated_on} />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
