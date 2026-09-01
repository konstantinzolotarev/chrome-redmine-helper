<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    children: Snippet;
  }

  let { title, description, children }: Props = $props();
</script>

<section class="rounded-lg border border-border bg-surface p-4">
  <h2 class="text-sm font-semibold">{title}</h2>
  {#if description}
    <p class="mt-0.5 text-xs text-text-muted">{description}</p>
  {/if}
  <div class="mt-3 flex flex-col gap-3">
    {@render children()}
  </div>
</section>
