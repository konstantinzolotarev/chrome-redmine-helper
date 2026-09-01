<script lang="ts">
  import { Check, Pencil, X } from 'lucide-svelte';

  interface Option {
    id: number;
    name: string;
  }

  interface Props {
    value: number | null | undefined;
    display: string;
    options: Option[];
    label: string;
    allowEmpty?: boolean;
    emptyLabel?: string;
    onsave: (next: number | null) => Promise<boolean> | boolean;
  }

  let {
    value,
    display,
    options,
    label,
    allowEmpty = false,
    emptyLabel = '—',
    onsave,
  }: Props = $props();

  let editing = $state(false);
  let saving = $state(false);
  let draft = $state<string>('');

  function start() {
    if (options.length === 0) return;
    draft = value == null ? '' : String(value);
    editing = true;
  }

  async function commit() {
    saving = true;
    try {
      await onsave(draft === '' ? null : Number(draft));
    } finally {
      saving = false;
      editing = false;
    }
  }
</script>

{#if editing}
  <span class="inline-flex items-center gap-1">
    <select
      bind:value={draft}
      disabled={saving}
      aria-label={label}
      class="rounded border border-border bg-bg px-1 py-0.5 text-xs"
    >
      {#if allowEmpty}
        <option value="">{emptyLabel}</option>
      {/if}
      {#each options as option (option.id)}
        <option value={String(option.id)}>{option.name}</option>
      {/each}
    </select>
    <button
      class="rounded p-0.5 text-success hover:bg-surface-hover"
      title="Save"
      aria-label="Save {label}"
      disabled={saving}
      onclick={commit}><Check size={13} /></button
    >
    <button
      class="rounded p-0.5 text-text-muted hover:bg-surface-hover"
      title="Cancel"
      aria-label="Cancel"
      disabled={saving}
      onclick={() => (editing = false)}><X size={13} /></button
    >
  </span>
{:else}
  <button
    class="group inline-flex items-center gap-1 rounded px-1 text-left hover:bg-surface-hover"
    title="Edit {label}"
    onclick={start}
  >
    {display}
    <span class="text-text-muted opacity-0 group-hover:opacity-100"><Pencil size={11} /></span>
  </button>
{/if}
