<script lang="ts">
  import { Check, Pencil, X } from 'lucide-svelte';

  interface Props {
    value: number | null | undefined;
    display: string;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    onsave: (next: number | null) => Promise<boolean> | boolean;
  }

  let { value, display, label, min, max, step = 1, onsave }: Props = $props();

  let editing = $state(false);
  let saving = $state(false);
  let draft = $state('');

  function start() {
    draft = value == null ? '' : String(value);
    editing = true;
  }

  async function commit() {
    saving = true;
    try {
      const parsed = draft.trim() === '' ? null : Number(draft);
      if (parsed !== null && !Number.isFinite(parsed)) return;
      await onsave(parsed);
    } finally {
      saving = false;
      editing = false;
    }
  }
</script>

{#if editing}
  <span class="inline-flex items-center gap-1">
    <input
      type="number"
      bind:value={draft}
      {min}
      {max}
      {step}
      disabled={saving}
      aria-label={label}
      class="w-20 rounded border border-border bg-bg px-1 py-0.5 text-xs"
      onkeydown={(event) => {
        if (event.key === 'Enter') void commit();
        if (event.key === 'Escape') editing = false;
      }}
    />
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
