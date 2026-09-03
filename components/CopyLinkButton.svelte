<script lang="ts">
  import { Check, Link } from 'lucide-svelte';

  import { toast } from '@/lib/store/ui.svelte';

  /**
   * Copy an issue's Redmine URL to the clipboard.
   *
   * Confirmation is the icon itself for a moment — a toast for something this
   * small would cover the list it was fired from.
   */

  interface Props {
    url: string;
    /** Completes "Copy link to …" for the accessible name. */
    label: string;
    size?: number;
  }

  let { url, label, size = 13 }: Props = $props();

  let copied = $state(false);
  let handle: ReturnType<typeof setTimeout> | undefined;

  // The icon reverts on its own, so a card that unmounts first must not leave
  // the timer holding it.
  $effect(() => () => clearTimeout(handle));

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      clearTimeout(handle);
      handle = setTimeout(() => (copied = false), 1500);
    } catch {
      toast.show('error', 'Could not copy the link to the clipboard.');
    }
  }
</script>

<button
  class="rounded p-1 {copied
    ? 'text-success'
    : 'text-text-muted hover:bg-surface-2 hover:text-text'}"
  title={copied ? 'Copied' : 'Copy link'}
  aria-label="Copy link to {label}"
  onclick={copy}
>
  {#if copied}<Check {size} />{:else}<Link {size} />{/if}
</button>
