<script lang="ts">
  import { discardSession, logSession, startTimer, stopTimer } from '@/lib/actions/timer.svelte';
  import { enums, timer } from '@/lib/store/app.svelte';
  import type { UnsentSession } from '@/lib/store/types';
  import { elapsedMs, formatDuration } from '@/lib/time';

  import LogTimeDialog from './LogTimeDialog.svelte';

  /**
   * The stop-timer flow, shared by both surfaces that can start a timer.
   *
   * Owns the running-timer banner and the log form that follows a stop. Callers
   * reach `toggle()` through `bind:this` — they hold the issue, this holds what
   * happens to it.
   */

  interface Props {
    /** Render the "Tracking #42 …" bar. The dialog renders either way. */
    banner?: boolean;
    /** Clicking the bar opens the issue being tracked. */
    onopen?: (issueId: number) => void;
  }

  let { banner = true, onopen }: Props = $props();

  let pendingSession = $state<UnsentSession | null>(null);

  // A clock for the running timer. Only the visible UI ticks — the stored state
  // is just `startedAt`, so nothing depends on this staying alive.
  let now = $state(Date.now());
  $effect(() => {
    if (!timer.current) return;
    const handle = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(handle);
  });

  const runningFor = $derived(timer.current ? elapsedMs(timer.current.startedAt, now) : 0);

  /** Start tracking this issue, or stop it and offer the log form. */
  export async function toggle(issueId: number, subject: string): Promise<void> {
    if (timer.current?.issueId === issueId) {
      pendingSession = await stopTimer();
    } else {
      await startTimer(issueId, subject);
    }
  }
</script>

{#if banner && timer.current}
  <button
    class="flex items-center justify-between border-b border-border bg-accent/10 px-3 py-1.5
           text-left text-xs hover:bg-accent/15"
    onclick={() => onopen?.(timer.current!.issueId)}
  >
    <span class="truncate">
      Tracking <span class="font-medium">#{timer.current.issueId}</span>
      {timer.current.issueSubject}
    </span>
    <span class="ml-2 shrink-0 font-mono">{formatDuration(runningFor)}</span>
  </button>
{/if}

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
