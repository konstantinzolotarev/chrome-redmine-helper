<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';

  import { describeDetail, type JournalContext } from '@/lib/format/journal';
  import type { Attachment, Journal } from '@/lib/redmine';

  import Markup from './Markup.svelte';
  import RelativeTime from './RelativeTime.svelte';

  interface Props {
    journal: Journal;
    context: JournalContext;
    host: string;
    attachments?: Attachment[];
  }

  let { journal, context, host, attachments = [] }: Props = $props();

  const changes = $derived(journal.details.map((detail) => describeDetail(detail, context)));

  function attachmentUrl(id: number | undefined): string | undefined {
    return attachments.find((file) => file.id === id)?.content_url;
  }
</script>

<article class="border-t border-border py-2 text-xs first:border-t-0">
  <header class="flex items-baseline gap-1.5 text-text-muted">
    <span class="font-medium text-text">{journal.user?.name ?? 'Someone'}</span>
    <RelativeTime value={journal.created_on} />
  </header>

  {#if changes.length > 0}
    <ul class="mt-1 flex flex-col gap-0.5">
      {#each changes as change, index (index)}
        <li class="flex flex-wrap items-center gap-1 text-text-muted">
          <span class="font-medium text-text">{change.label}</span>
          {#if change.kind === 'changed' && change.from !== undefined}
            <span class="line-through">{change.from}</span>
            <ArrowRight size={11} />
            <span class="text-text">{change.to}</span>
          {:else if change.kind === 'cleared'}
            cleared <span class="line-through">{change.from}</span>
          {:else if change.kind === 'added'}
            added
            {#if attachmentUrl(change.attachmentId)}
              <a
                href={attachmentUrl(change.attachmentId)}
                target="_blank"
                rel="noopener noreferrer"
                class="text-accent hover:underline">{change.to}</a
              >
            {:else}
              <span class="text-text">{change.to}</span>
            {/if}
          {:else if change.kind === 'removed'}
            removed <span class="line-through">{change.from}</span>
          {:else}
            set to <span class="text-text">{change.to}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if journal.notes}
    <div class="mt-1.5 rounded bg-surface-2 p-2">
      <Markup text={journal.notes} {host} />
    </div>
  {/if}
</article>
