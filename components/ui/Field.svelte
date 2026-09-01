<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    hint?: string;
    for?: string;
    children: Snippet;
  }

  let { label, hint, for: htmlFor, children }: Props = $props();
</script>

<div class="flex flex-col gap-1">
  <label class="text-xs font-medium" for={htmlFor}>{label}</label>
  {@render children()}
  {#if hint}
    <p class="text-xs text-text-muted">{hint}</p>
  {/if}
</div>
