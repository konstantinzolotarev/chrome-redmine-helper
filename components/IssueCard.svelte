<script lang="ts">
  import { Eye, Pause, Play } from 'lucide-svelte';

  import type { Issue } from '@/lib/redmine';

  import RelativeTime from './RelativeTime.svelte';

  interface Props {
    issue: Issue;
    unread: boolean;
    watched?: boolean;
    tracking?: boolean;
    onopen: () => void;
    ontoggletimer: () => void;
  }

  let { issue, unread, watched = false, tracking = false, onopen, ontoggletimer }: Props = $props();
</script>

<li class="border-b border-border last:border-b-0">
  <div class="flex items-start gap-2 px-3 py-2 hover:bg-surface-hover">
    <span
      class="mt-1.5 size-1.5 shrink-0 rounded-full {unread ? 'bg-unread' : 'bg-transparent'}"
      aria-label={unread ? 'Unread' : 'Read'}
    ></span>

    <button class="min-w-0 flex-1 text-left" onclick={onopen}>
      <div class="flex items-baseline gap-1.5">
        <span class="shrink-0 text-xs text-text-muted">#{issue.id}</span>
        <span class="truncate text-xs {unread ? 'font-semibold' : ''}">{issue.subject}</span>
      </div>
      <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
        <span class="truncate">{issue.project.name}</span>
        <span aria-hidden="true">·</span>
        <span class="shrink-0">{issue.status.name}</span>
        {#if watched}
          <span class="shrink-0" title="You are watching this issue"><Eye size={11} /></span>
        {/if}
        <span aria-hidden="true">·</span>
        <RelativeTime value={issue.updated_on} />
      </div>
    </button>

    <button
      class="mt-0.5 shrink-0 rounded p-1 {tracking
        ? 'text-danger'
        : 'text-text-muted hover:bg-surface-2 hover:text-text'}"
      title={tracking ? 'Stop tracking time' : 'Start tracking time'}
      aria-label={tracking ? `Stop tracking time on issue ${issue.id}` : `Start tracking time on issue ${issue.id}`}
      onclick={ontoggletimer}
    >
      {#if tracking}<Pause size={13} />{:else}<Play size={13} />{/if}
    </button>
  </div>
</li>
