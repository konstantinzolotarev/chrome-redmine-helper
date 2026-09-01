<script lang="ts">
  import { Clock } from 'lucide-svelte';

  import type { Enumeration } from '@/lib/redmine';
  import type { UnsentSession } from '@/lib/store/types';

  import Button from './ui/Button.svelte';
  import Field from './ui/Field.svelte';

  interface Props {
    session: UnsentSession;
    activities: Enumeration[];
    onlog: (
      overrides: Pick<UnsentSession, 'hours' | 'spentOn' | 'activityId' | 'comments'>,
    ) => Promise<boolean>;
    ondiscard: () => void;
    onclose: () => void;
  }

  let { session, activities, onlog, ondiscard, onclose }: Props = $props();

  /*
   * Seeded once, deliberately: this is an editable draft, not a mirror of the
   * prop. Callers key the dialog on `session.id` so a different session
   * remounts it with fresh values.
   */
  // svelte-ignore state_referenced_locally
  let hours = $state(String(session.hours));
  // svelte-ignore state_referenced_locally
  let spentOn = $state(session.spentOn);
  // svelte-ignore state_referenced_locally
  let activityId = $state(
    String(session.activityId ?? activities.find((a) => a.is_default)?.id ?? activities[0]?.id ?? ''),
  );
  // svelte-ignore state_referenced_locally
  let comments = $state(session.comments);
  let saving = $state(false);

  const hoursValid = $derived(Number(hours) > 0 && Number.isFinite(Number(hours)));

  async function submit() {
    if (!hoursValid) return;
    saving = true;
    try {
      const ok = await onlog({
        hours: Number(hours),
        spentOn,
        activityId: activityId === '' ? null : Number(activityId),
        comments,
      });
      if (ok) onclose();
    } finally {
      saving = false;
    }
  }
</script>

<!-- Native <dialog> rather than a headless library: it gives focus trapping,
     Escape-to-close and the top layer for free. -->
<dialog
  open
  class="fixed inset-0 z-50 m-auto w-[min(22rem,92vw)] rounded-lg border border-border
         bg-surface p-4 text-text shadow-xl backdrop:bg-black/40"
  aria-label="Log time"
>
  <h2 class="flex items-center gap-1.5 text-sm font-semibold">
    <Clock size={15} />
    Log time
  </h2>
  <p class="mt-0.5 truncate text-xs text-text-muted">
    #{session.issueId} {session.issueSubject}
  </p>

  <div class="mt-3 flex flex-col gap-3">
    <div class="grid grid-cols-2 gap-3">
      <Field label="Hours" for="log-hours">
        {#snippet children()}
          <input
            id="log-hours"
            type="number"
            step="0.25"
            min="0.01"
            bind:value={hours}
            class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
          />
        {/snippet}
      </Field>

      <Field label="Date" for="log-date">
        {#snippet children()}
          <input
            id="log-date"
            type="date"
            bind:value={spentOn}
            class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
          />
        {/snippet}
      </Field>
    </div>

    <Field label="Activity" for="log-activity">
      {#snippet children()}
        <select
          id="log-activity"
          bind:value={activityId}
          class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
        >
          {#each activities as activity (activity.id)}
            <option value={String(activity.id)}>{activity.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>

    <Field label="Comment" for="log-comment">
      {#snippet children()}
        <input
          id="log-comment"
          type="text"
          bind:value={comments}
          placeholder="Optional"
          class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
        />
      {/snippet}
    </Field>
  </div>

  <div class="mt-4 flex items-center justify-between">
    <Button variant="ghost" onclick={ondiscard}>
      {#snippet children()}Discard{/snippet}
    </Button>
    <div class="flex gap-2">
      <Button onclick={onclose}>
        {#snippet children()}Later{/snippet}
      </Button>
      <Button variant="primary" loading={saving} disabled={!hoursValid} onclick={submit}>
        {#snippet children()}Log time{/snippet}
      </Button>
    </div>
  </div>

  {#if session.lastError}
    <p class="mt-2 text-xs text-danger">{session.lastError}</p>
  {/if}
</dialog>
