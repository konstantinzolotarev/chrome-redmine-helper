<script lang="ts">
  import { Book, Clock, ListTodo, Newspaper, Plus, Settings } from 'lucide-svelte';
  import { browser } from 'wxt/browser';

  import IssueDetail from '@/components/IssueDetail.svelte';
  import TimerHost from '@/components/TimerHost.svelte';
  import Banner from '@/components/ui/Banner.svelte';
  import Button from '@/components/ui/Button.svelte';
  import IssueTable from '@/components/views/IssueTable.svelte';
  import News from '@/components/views/News.svelte';
  import NewIssue from '@/components/views/NewIssue.svelte';
  import Projects from '@/components/views/Projects.svelte';
  import TimeLog from '@/components/views/TimeLog.svelte';
  import { issueUrl } from '@/lib/format/markup';
  import { idSegment, routeName } from '@/lib/router';
  import { navigate, useRoute } from '@/lib/router.svelte';
  import {
    isConfigured,
    issues,
    markIssueRead,
    prefs,
    secrets,
    syncMeta,
    timer,
    unsentSessions,
  } from '@/lib/store/app.svelte';
  import { toast } from '@/lib/store/ui.svelte';
  import { useTheme } from '@/lib/theme.svelte';

  useTheme();

  const route = useRoute('/issues');
  const current = $derived(routeName(route.current));
  const ready = $derived(!prefs.loading && !secrets.loading);
  const queued = $derived(unsentSessions.current.length);

  let timerHost = $state<TimerHost | null>(null);

  // The selection is the route: `#/issues/42`. That buys Back/Forward through
  // issues, a reload that keeps its place, and a link worth sending.
  const selectedId = $derived(current === 'issues' ? idSegment(route.current) : null);
  const selected = $derived(selectedId === null ? null : issues.current[String(selectedId)]);

  $effect(() => {
    const id = selectedId;
    if (id !== null) void markIssueRead(id);
  });

  const nav = [
    { name: 'issues', href: '#/issues', label: 'Issues', icon: ListTodo },
    { name: 'news', href: '#/news', label: 'News', icon: Newspaper },
    { name: 'projects', href: '#/projects', label: 'Projects', icon: Book },
    { name: 'time', href: '#/time', label: 'Time log', icon: Clock },
    { name: 'new-issue', href: '#/new-issue', label: 'New issue', icon: Plus },
  ];

  // Single source of truth: the manifest version, which WXT takes from
  // package.json. Hardcoding it here let it drift once already.
  const version = browser.runtime.getManifest().version;
</script>

<div class="mx-auto flex min-h-screen max-w-5xl flex-col">
  <header class="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2">
    <h1 class="mr-4 text-sm font-semibold">Redmine Helper</h1>

    {#each nav as item (item.name)}
      <a
        href={item.href}
        aria-current={current === item.name ? 'page' : undefined}
        class="flex items-center gap-1.5 rounded px-2 py-1 text-xs
               {current === item.name
          ? 'bg-surface-2 font-medium text-text'
          : 'text-text-muted hover:bg-surface-hover hover:text-text'}"
      >
        <item.icon size={14} />
        {item.label}
        {#if item.name === 'time' && queued > 0}
          <span class="rounded-full bg-warning/25 px-1.5 text-[10px] font-semibold">{queued}</span>
        {/if}
      </a>
    {/each}

    <button
      class="ml-auto flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-muted
             hover:bg-surface-hover hover:text-text"
      onclick={() => browser.runtime.openOptionsPage()}
    >
      <Settings size={14} />
      Options
    </button>
  </header>

  <!-- Above <main> so the running timer stays visible on every tab, not just
       the issue list. -->
  <TimerHost bind:this={timerHost} onopen={(id) => navigate(`/issues/${id}`)} />

  <main class="flex-1 p-4">
    {#if !ready}
      <p class="text-xs text-text-muted">Loading…</p>
    {:else if !isConfigured()}
      <div class="max-w-md">
        <Banner
          tone="info"
          title="Not connected yet"
          message="Add your Redmine host and API key to get started."
        />
        <div class="mt-2">
          <Button variant="primary" onclick={() => browser.runtime.openOptionsPage()}>
            {#snippet children()}Open options{/snippet}
          </Button>
        </div>
      </div>
    {:else}
      {#if toast.current}
        <div class="mb-3 max-w-md">
          <Banner
            tone={toast.current.tone === 'error' ? 'error' : 'success'}
            title={toast.current.tone === 'error' ? 'Something went wrong' : 'Done'}
            message={toast.current.text}
          />
        </div>
      {/if}

      {#if syncMeta.current.lastErrorMessage && current === 'issues'}
        <div class="mb-3 max-w-md">
          <Banner tone="error" title="Sync failed" message={syncMeta.current.lastErrorMessage} />
        </div>
      {/if}

      {#if current === 'news'}
        <News />
      {:else if current === 'projects'}
        <Projects />
      {:else if current === 'time'}
        <TimeLog />
      {:else if current === 'new-issue'}
        <NewIssue />
      {:else}
        <div class="grid gap-4 {selectedId !== null ? 'lg:grid-cols-[1fr_380px]' : ''}">
          <!-- Narrower than `lg` there is no room for both, so the pane takes
               over the way the side panel does. -->
          <div class={selectedId !== null ? 'hidden lg:block' : ''}>
            <IssueTable
              {selectedId}
              trackingId={timer.current?.issueId ?? null}
              ontoggletimer={(issue) => timerHost?.toggle(issue.id, issue.subject)}
            />
          </div>

          {#if selectedId !== null}
            <aside
              class="overflow-hidden rounded-md border border-border
                     lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)]"
            >
              {#if selected}
                <IssueDetail issue={selected} onback={() => navigate('/issues')} />
              {:else if issues.loading}
                <p class="p-4 text-center text-xs text-text-muted">Loading…</p>
              {:else}
                <div class="flex flex-col items-start gap-2 p-4 text-xs">
                  <p class="text-text-muted">
                    Issue #{selectedId} isn't in your list — it may have been reassigned, or
                    dropped from the cache after 90 days.
                  </p>
                  <a
                    href={issueUrl(prefs.current.host, selectedId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-accent hover:underline">Open #{selectedId} in Redmine</a
                  >
                  <button class="text-text-muted hover:text-text" onclick={() => navigate('/issues')}>
                    Back to the list
                  </button>
                </div>
              {/if}
            </aside>
          {/if}
        </div>
      {/if}
    {/if}
  </main>

  <footer class="border-t border-border px-4 py-2 text-[11px] text-text-muted">
    Redmine Helper {version}
  </footer>
</div>
