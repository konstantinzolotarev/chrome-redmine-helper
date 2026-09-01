<script lang="ts">
  import { issueUrl, tokenize } from '@/lib/format/markup';

  interface Props {
    text: string | null | undefined;
    /** Redmine host, so #1234 references can link out. */
    host?: string;
  }

  let { text, host = '' }: Props = $props();

  // Segments are data. Everything below is ordinary interpolation, so Svelte
  // escapes it — there is no `{@html}` path anywhere in this component (D1).
  const segments = $derived(tokenize(text));
</script>

<span class="break-words whitespace-pre-wrap">
  {#each segments as segment, index (index)}
    {#if segment.type === 'url'}
      <a
        href={segment.value}
        target="_blank"
        rel="noopener noreferrer"
        class="text-accent hover:underline">{segment.value}</a
      >
    {:else if segment.type === 'issue' && host}
      <a
        href={issueUrl(host, segment.id)}
        target="_blank"
        rel="noopener noreferrer"
        class="text-accent hover:underline">{segment.value}</a
      >
    {:else}{segment.value}{/if}
  {/each}
</span>
