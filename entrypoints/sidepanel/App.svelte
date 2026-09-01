<script lang="ts">
  import { CheckCheck, Inbox, RefreshCw, Search, Settings, X } from 'lucide-svelte';
  import { browser } from 'wxt/browser';

  import IssueCard from '@/components/IssueCard.svelte';
  import IssueDetail from '@/components/IssueDetail.svelte';
  import LogTimeDialog from '@/components/LogTimeDialog.svelte';
  import Banner from '@/components/ui/Banner.svelte';
  import Button from '@/components/ui/Button.svelte';
  import { startTimer, stopTimer, logSession, discardSession } from '@/lib/actions/timer.svelte';
  import { openTabPage } from '@/lib/pages';
  import {
    allIssues,
    enums,
    isConfigured,
    issues,
    isWatched,
    markAllIssuesRead,
    markIssueRead,
    prefs,
    readState,
    secrets,
    syncMeta,
    timer,
  } from '@/lib/store/app.svelte';
  import { isUnread } from '@/lib/store/derive';
  import type { UnsentSession } from '@/lib/store/types';
  import { toast } from '@/lib/store/ui.svelte';
  import { useTheme } from '@/lib/theme.svelte';
  import { elapsedMs, formatDuration } from '@/lib/time';

  useTheme();

  let query = $state('');
  let selectedId = $state<number | null>(null);
  let refreshing = $state(false);
  let pendingSession = $state<UnsentSession | null>(null);

  // A clock for the running timer. Only the visible UI ticks — the stored state
  // is just `startedAt`, so nothing depends on this staying alive.
  let now = $state(Date.now());
  $effect(() => {
    if (!timer.current) return;
    const handle = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(handle);
  });

  const ready = $derived(!issues.loading && !prefs.loading && !secrets.loading);

  const visible = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    const list = allIssues();
    if (!needle) return list;
    return list.filter(
      (issue) =>
        issue.subject.toLowerCase().includes(needle) || String(issue.id).includes(needle),
    );
  });

  const selected = $derived(selectedId === null ? null : issues.current[String(selectedId)]);
  const unreadTotal = $derived(
    Object.values(issues.current).filter((issue) => isUnread(issue, readState.current)).length,
  );

  const runningFor = $derived(timer.current ? elapsedMs(timer.current.startedAt, now) : 0);

  async function refresh() {
    refreshing = true;
    try {
      // The worker owns polling; ask it to run one now rather than duplicating
      // the delta logic here.
      await browser.runtime.sendMessage({ type: 'poll' });
    } catch {
      toast.show('error', 'Could not reach the extension background worker.');
    } finally {
      refreshing = false;
    }
  }

  async function open(id: number) {
    selectedId = id;
    await markIssueRead(id);
  }

  async function toggleTimer(issueId: number, subject: string) {
    if (timer.current?.issueId === issueId) {
      pendingSession = await stopTimer();
    } else {
      await startTimer(issueId, subject);
    }
  }
</script>

<div class="flex h-screen flex-col">
  {#if selected}
    <IssueDetail issue={selected} onback={() => (selectedId = null)} />
  {:else}
    <header class="flex items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5">
      <div class="relative flex-1">
        <span class="pointer-events-none absolute top-1.5 left-2 text-text-muted">
          <Search size={13} />
        </span>
        <input
          bind:value={query}
          placeholder="Search issues"
          aria-label="Search issues"
          class="w-full rounded-md border border-border bg-bg py-1 pr-2 pl-7 text-xs focus:border-accent"
        />
        {#if query}
          <button
            class="absolute top-1.5 right-1.5 text-text-muted hover:text-text"
            title="Clear search"
            aria-label="Clear search"
            onclick={() => (query = '')}><X size={13} /></button
          >
        {/if}
      </div>

      <button
        class="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text"
        class:animate-spin={refreshing}
        title="Refresh now"
        aria-label="Refresh now"
        onclick={refresh}><RefreshCw size={14} /></button
      >
      <button
        class="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text"
        title="Mark all read"
        aria-label="Mark all read"
        onclick={markAllIssuesRead}><CheckCheck size={14} /></button
      >
      <button
        class="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text"
        title="Options"
        aria-label="Options"
        onclick={() => browser.runtime.openOptionsPage()}><Settings size={14} /></button
      >
    </header>

    {#if timer.current}
      <button
        class="flex items-center justify-between border-b border-border bg-accent/10 px-3 py-1.5
               text-left text-xs hover:bg-accent/15"
        onclick={() => open(timer.current!.issueId)}
      >
        <span class="truncate">
          Tracking <span class="font-medium">#{timer.current.issueId}</span>
          {timer.current.issueSubject}
        </span>
        <span class="ml-2 shrink-0 font-mono">{formatDuration(runningFor)}</span>
      </button>
    {/if}

    {#if toast.current}
      <div class="p-2">
        <Banner
          tone={toast.current.tone === 'error' ? 'error' : 'success'}
          title={toast.current.tone === 'error' ? 'Something went wrong' : 'Done'}
          message={toast.current.text}
        />
      </div>
    {/if}

    <main class="flex-1 overflow-y-auto">
      {#if !ready}
        <p class="p-4 text-center text-xs text-text-muted">Loading…</p>
      {:else if !isConfigured()}
        <div class="p-3">
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
      {:else if syncMeta.current.lastErrorMessage}
        <div class="p-3">
          <Banner tone="error" title="Sync failed" message={syncMeta.current.lastErrorMessage} />
        </div>
      {:else if visible.length === 0}
        <div class="flex flex-col items-center gap-2 p-8 text-center text-text-muted">
          <Inbox size={22} />
          <p class="text-xs">
            {query ? 'No issues match that search.' : 'No issues assigned to you yet.'}
          </p>
        </div>
      {:else}
        <ul>
          {#each visible as issue (issue.id)}
            <IssueCard
              {issue}
              unread={isUnread(issue, readState.current)}
              watched={isWatched(issue)}
              tracking={timer.current?.issueId === issue.id}
              onopen={() => open(issue.id)}
              ontoggletimer={() => toggleTimer(issue.id, issue.subject)}
            />
          {/each}
        </ul>
      {/if}
    </main>

    <footer
      class="border-t border-border px-3 py-1 text-[11px] text-text-muted"
      aria-live="polite"
    >
      {visible.length}
      {visible.length === 1 ? 'issue' : 'issues'}
      {#if unreadTotal > 0}· {unreadTotal} unread{/if}
      <button class="float-right hover:text-text" onclick={() => openTabPage('/issues')}>
        Open full view
      </button>
    </footer>
  {/if}
</div>

{#if pendingSession}
  <!-- Keyed so a different session remounts the form with fresh values. -->
  {#key pendingSession.id}
    <LogTimeDialog
      session={pendingSession}
      activities={enums.current.activities}
      onlog={(overrides) => logSession(pendingSession!, overrides)}
      ondiscard={async () => {
        await discardSession(pendingSession!.id);
        pendingSession = null;
      }}
      onclose={() => (pendingSession = null)}
    />
  {/key}
{/if}
