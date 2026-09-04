<script lang="ts">
  import { ExternalLink, Eye, Pause, Play, Search } from 'lucide-svelte';

  import { issueUrl } from '@/lib/format/markup';
  import type { Issue } from '@/lib/redmine';
  import { allIssues, enums, isWatched, prefs, projects, readState } from '@/lib/store/app.svelte';
  import { isUnread } from '@/lib/store/derive';
  import {
    activeFilterCount,
    clampPage,
    filterIssues,
    pageCount,
    pageSlice,
    normalizePageSize,
    PAGE_SIZES,
    type StatusFilter,
  } from '@/lib/table';

  import CopyLinkButton from '../CopyLinkButton.svelte';
  import RelativeTime from '../RelativeTime.svelte';
  import MultiSelect, { type Option } from '../ui/MultiSelect.svelte';

  interface Props {
    /** The issue open in the detail pane, from the route. */
    selectedId?: number | null;
    /** The issue whose timer is running, if it is one of these. */
    trackingId?: number | null;
    ontoggletimer?: (issue: Issue) => void;
  }

  let { selectedId = null, trackingId = null, ontoggletimer }: Props = $props();

  let query = $state('');
  let projectIds = $state<number[]>([]);
  let statusChoices = $state<StatusFilter[]>([]);
  let trackerIds = $state<number[]>([]);
  let page = $state(1);

  const columns = $derived(prefs.current.columns);
  const host = $derived(prefs.current.host);
  const pageSize = $derived(normalizePageSize(prefs.current.pageSize));

  const projectList = $derived(
    Object.values(projects.current).sort((a, b) => a.name.localeCompare(b.name)),
  );
  const statuses = $derived(enums.current.statuses);
  const trackers = $derived(enums.current.trackers);

  const projectOptions = $derived<Option[]>(
    projectList.map((project) => ({ value: String(project.id), label: project.name })),
  );
  // "Any open"/"Any closed" rather than "Open"/"Closed": most Redmine
  // configurations have a status named exactly Closed, and two entries reading
  // the same in one list is a puzzle rather than a filter.
  const statusOptions = $derived<Option[]>([
    { value: 'open', label: 'Any open' },
    { value: 'closed', label: 'Any closed' },
    ...statuses.map((option) => ({ value: String(option.id), label: option.name })),
  ]);
  const trackerOptions = $derived<Option[]>(
    trackers.map((tracker) => ({ value: String(tracker.id), label: tracker.name })),
  );

  const filters = $derived({ query, projectIds, statuses: statusChoices, trackerIds });
  const filtered = $derived(filterIssues(allIssues(), filters, statuses));
  const narrowed = $derived(query.trim() !== '' || activeFilterCount(filters) > 0);

  // The page is clamped on read rather than corrected in an effect: the list
  // shrinks under the user whenever a poll prunes it or a filter narrows it.
  const currentPage = $derived(clampPage(page, filtered.length, pageSize));
  const pages = $derived(pageCount(filtered.length, pageSize));
  const rows = $derived(pageSlice(filtered, currentPage, pageSize));
  const firstShown = $derived(filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1);
  const lastShown = $derived(Math.min(currentPage * pageSize, filtered.length));

  /** Narrowing starts from the top — page 3 of a filtered list is a different page 3. */
  function narrow<T>(apply: (value: T) => void): (value: T) => void {
    return (value) => {
      apply(value);
      page = 1;
    };
  }

  const setProjects = narrow<string[]>((next) => (projectIds = next.map(Number)));
  const setTrackers = narrow<string[]>((next) => (trackerIds = next.map(Number)));
  const setStatuses = narrow<string[]>((next) => {
    statusChoices = next.map((value) =>
      value === 'open' || value === 'closed' ? value : Number(value),
    );
  });

  async function setPageSize(next: number) {
    page = 1;
    await prefs.update((current) => ({ ...current, pageSize: next }));
  }

  const selectClass =
    'rounded-md border border-border bg-bg px-2 py-1.5 text-xs focus:border-accent';
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
    <MultiSelect
      label="Projects"
      options={projectOptions}
      selected={projectIds.map(String)}
      onchange={setProjects}
    />

    <MultiSelect
      label="Status"
      options={statusOptions}
      selected={statusChoices.map(String)}
      onchange={setStatuses}
    />

    <MultiSelect
      label="Trackers"
      options={trackerOptions}
      selected={trackerIds.map(String)}
      onchange={setTrackers}
    />

    <span class="text-xs text-text-muted" aria-live="polite">
      {filtered.length}
      {filtered.length === 1 ? 'issue' : 'issues'}
    </span>
  </div>

  {#if rows.length === 0}
    <p class="rounded-md border border-border p-6 text-center text-xs text-text-muted">
      {narrowed ? 'No issues match that search.' : 'Nothing here yet.'}
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
            <th class="w-14 px-2 py-1.5"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as issue (issue.id)}
            {@const unread = isUnread(issue, readState.current)}
            {@const selected = issue.id === selectedId}
            {@const tracking = issue.id === trackingId}
            <tr
              class="group border-t border-border hover:bg-surface-hover
                     {selected ? 'bg-surface-2' : ''}"
            >
              <td class="px-2 py-1.5">
                {#if unread}
                  <span class="block size-1.5 rounded-full bg-unread" aria-label="Unread"></span>
                {/if}
              </td>
              {#if columns.id}
                <td class="px-2 py-1.5 text-text-muted">{issue.id}</td>
              {/if}
              <td class="max-w-md px-2 py-1.5">
                <!-- An anchor, not a button: ⌘-click and middle-click open a
                     second tab, and the route is the selection (#/issues/42). -->
                <a
                  href="#/issues/{issue.id}"
                  aria-current={selected ? 'true' : undefined}
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
              <td class="px-2 py-1.5">
                <!-- Revealed on hover, but kept visible whenever the row is the
                     one being read or timed, so nothing disappears mid-task.
                     `focus-within` covers the keyboard. -->
                <div
                  class="flex items-center justify-end gap-0.5 transition-opacity
                         group-hover:opacity-100 focus-within:opacity-100
                         {selected || tracking ? 'opacity-100' : 'opacity-0'}"
                >
                  <button
                    class="rounded p-1 {tracking
                      ? 'text-danger'
                      : 'text-text-muted hover:bg-surface-2 hover:text-text'}"
                    title={tracking ? 'Stop tracking time' : 'Start tracking time'}
                    aria-label={tracking
                      ? `Stop tracking time on issue ${issue.id}`
                      : `Start tracking time on issue ${issue.id}`}
                    onclick={() => ontoggletimer?.(issue)}
                  >
                    {#if tracking}<Pause size={13} />{:else}<Play size={13} />{/if}
                  </button>
                  <CopyLinkButton url={issueUrl(host, issue.id)} label="issue {issue.id}" />
                  <a
                    class="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-text"
                    href={issueUrl(host, issue.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in Redmine"
                    aria-label="Open issue {issue.id} in Redmine"><ExternalLink size={13} /></a
                  >
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if filtered.length > PAGE_SIZES[0]}
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <label class="flex items-center gap-1.5">
          Show
          <select
            class={selectClass}
            aria-label="Rows per page"
            value={String(pageSize)}
            onchange={(event) => setPageSize(Number(event.currentTarget.value))}
          >
            {#each PAGE_SIZES as size (size)}
              <option value={String(size)}>{size}</option>
            {/each}
          </select>
        </label>

        <div class="flex items-center gap-3">
          <button
            class="rounded px-2 py-1 hover:bg-surface-hover hover:text-text disabled:opacity-40
                   disabled:hover:bg-transparent"
            disabled={currentPage <= 1}
            onclick={() => (page = currentPage - 1)}>&lsaquo; Prev</button
          >
          <span aria-live="polite">{firstShown}&ndash;{lastShown} of {filtered.length}</span>
          <button
            class="rounded px-2 py-1 hover:bg-surface-hover hover:text-text disabled:opacity-40
                   disabled:hover:bg-transparent"
            disabled={currentPage >= pages}
            onclick={() => (page = currentPage + 1)}>Next &rsaquo;</button
          >
        </div>
      </div>
    {/if}
  {/if}
</div>
