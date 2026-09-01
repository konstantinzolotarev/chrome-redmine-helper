<script lang="ts">
  import { Newspaper } from 'lucide-svelte';

  import { fetchNews } from '@/lib/actions/catalog.svelte';
  import type { NewsItem } from '@/lib/redmine';
  import { prefs } from '@/lib/store/app.svelte';

  import Markup from '../Markup.svelte';
  import RelativeTime from '../RelativeTime.svelte';

  let items = $state<NewsItem[]>([]);
  let loading = $state(true);

  $effect(() => {
    void (async () => {
      items = await fetchNews();
      loading = false;
    })();
  });
</script>

{#if loading}
  <p class="text-xs text-text-muted">Loading…</p>
{:else if items.length === 0}
  <div class="flex flex-col items-center gap-2 rounded-md border border-border p-8 text-text-muted">
    <Newspaper size={22} />
    <p class="text-xs">No news posted in your Redmine.</p>
  </div>
{:else}
  <ul class="flex flex-col gap-3">
    {#each items as item (item.id)}
      <li class="rounded-md border border-border p-3">
        <h2 class="text-sm font-semibold">{item.title}</h2>
        <p class="mt-0.5 text-[11px] text-text-muted">
          {item.project?.name} · {item.author?.name}
          <RelativeTime value={item.created_on} prefix=" " />
        </p>
        {#if item.description}
          <div class="mt-2 text-xs">
            <Markup text={item.description} host={prefs.current.host} />
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
