<script lang="ts">
  import { Clock, RotateCw, Trash2 } from 'lucide-svelte';

  import { discardSession, logSession } from '@/lib/actions/timer.svelte';
  import { issueUrl } from '@/lib/format/markup';
  import { enums, prefs, timer, unsentSessions } from '@/lib/store/app.svelte';
  import type { UnsentSession } from '@/lib/store/types';
  import { elapsedMs, formatDuration } from '@/lib/time';

  import RelativeTime from '../RelativeTime.svelte';
  import Button from '../ui/Button.svelte';

  let busy = $state<string | null>(null);
  let now = $state(Date.now());

  $effect(() => {
    if (!timer.current) return;
    const handle = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(handle);
  });

  const queue = $derived(unsentSessions.current);

  async function retry(session: UnsentSession, overrides: Partial<UnsentSession> = {}) {
    busy = session.id;
    try {
      await logSession(session, overrides);
    } finally {
      busy = null;
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if timer.current}
    <div class="flex items-center justify-between rounded-md border border-accent/40 bg-accent/10 p-3">
      <div class="min-w-0">
        <p class="text-xs font-medium">
          Tracking #{timer.current.issueId} — {timer.current.issueSubject}
        </p>
        <p class="text-[11px] text-text-muted">
          started <RelativeTime value={timer.current.startedAt} />
        </p>
      </div>
      <span class="font-mono text-sm">{formatDuration(elapsedMs(timer.current.startedAt, now))}</span>
    </div>
  {/if}

  <section>
    <h2 class="text-sm font-semibold">Waiting to be logged</h2>
    <p class="mt-0.5 text-xs text-text-muted">
      Sessions tracked here that have not reached Redmine yet. Nothing is discarded on its own.
    </p>

    {#if queue.length === 0}
      <div class="mt-3 flex flex-col items-center gap-2 rounded-md border border-border p-8 text-text-muted">
        <Clock size={22} />
        <p class="text-xs">Nothing waiting — every tracked session has been logged.</p>
      </div>
    {:else}
      <ul class="mt-3 flex flex-col gap-2">
        {#each queue as session (session.id)}
          <li class="rounded-md border border-border p-3">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <a
                href={issueUrl(prefs.current.host, session.issueId)}
                target="_blank"
                rel="noopener noreferrer"
                class="truncate text-xs font-medium hover:text-accent hover:underline"
                >#{session.issueId} {session.issueSubject}</a
              >
              <span class="text-xs text-text-muted">{session.spentOn}</span>
            </div>

            <div class="mt-2 flex flex-wrap items-end gap-2">
              <label class="flex flex-col gap-0.5 text-[11px] text-text-muted">
                Hours
                <input
                  type="number"
                  step="0.25"
                  min="0.01"
                  value={session.hours}
                  onchange={(event) =>
                    unsentSessions.update((list) =>
                      list.map((item) =>
                        item.id === session.id
                          ? { ...item, hours: Number(event.currentTarget.value) }
                          : item,
                      ),
                    )}
                  class="w-20 rounded border border-border bg-bg px-1.5 py-1 text-xs text-text"
                />
              </label>

              <label class="flex flex-col gap-0.5 text-[11px] text-text-muted">
                Activity
                <select
                  value={String(session.activityId ?? '')}
                  onchange={(event) =>
                    unsentSessions.update((list) =>
                      list.map((item) =>
                        item.id === session.id
                          ? {
                              ...item,
                              activityId:
                                event.currentTarget.value === ''
                                  ? null
                                  : Number(event.currentTarget.value),
                            }
                          : item,
                      ),
                    )}
                  class="rounded border border-border bg-bg px-1.5 py-1 text-xs text-text"
                >
                  <option value="">Default</option>
                  {#each enums.current.activities as activity (activity.id)}
                    <option value={String(activity.id)}>{activity.name}</option>
                  {/each}
                </select>
              </label>

              <label class="flex flex-1 flex-col gap-0.5 text-[11px] text-text-muted">
                Comment
                <input
                  type="text"
                  value={session.comments}
                  onchange={(event) =>
                    unsentSessions.update((list) =>
                      list.map((item) =>
                        item.id === session.id
                          ? { ...item, comments: event.currentTarget.value }
                          : item,
                      ),
                    )}
                  class="w-full rounded border border-border bg-bg px-1.5 py-1 text-xs text-text"
                />
              </label>

              <Button
                variant="primary"
                loading={busy === session.id}
                onclick={() => retry(session)}
              >
                {#snippet children()}
                  <RotateCw size={12} />
                  Log
                {/snippet}
              </Button>

              <Button variant="danger" onclick={() => discardSession(session.id)}>
                {#snippet children()}
                  <Trash2 size={12} />
                  Discard
                {/snippet}
              </Button>
            </div>

            {#if session.lastError}
              <p class="mt-2 text-xs text-danger">
                Attempt {session.attempts}: {session.lastError}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
