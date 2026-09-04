<script lang="ts">
  import { Check, ChevronDown } from 'lucide-svelte';

  /**
   * A filter dropdown holding checkboxes.
   *
   * Values are strings so the checkbox list stays trivial; callers map to
   * whatever they actually hold. An empty selection means "no constraint",
   * which is why the button reads as the plural label rather than "None".
   */

  export interface Option {
    value: string;
    label: string;
  }

  interface Props {
    /** Shown when nothing is selected, e.g. "Projects". */
    label: string;
    options: Option[];
    selected: string[];
    onchange: (next: string[]) => void;
  }

  let { label, options, selected, onchange }: Props = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);

  const chosen = $derived(new Set(selected));

  // One selection is worth naming; several are only worth counting.
  const summary = $derived(
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? label)
        : `${label} · ${selected.length}`,
  );

  // Both listeners live on the document rather than the wrapper: pointer-down
  // rather than click, because a drag that starts inside and ends outside would
  // otherwise close the panel out from under the checkbox being toggled; and
  // keydown, so Escape works wherever focus happens to be.
  $effect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root?.contains(event.target as Node)) open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      open = false;
      trigger?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  function toggle(value: string) {
    onchange(chosen.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }
</script>

<div bind:this={root} class="relative">
  <button
    bind:this={trigger}
    type="button"
    class="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs
           {selected.length > 0
      ? 'border-accent text-text'
      : 'border-border text-text-muted hover:text-text'}"
    aria-expanded={open}
    aria-haspopup="true"
    onclick={() => (open = !open)}
  >
    {summary}
    <ChevronDown size={12} />
  </button>

  {#if open}
    <div
      class="absolute z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border
             bg-surface py-1 shadow-lg"
      role="group"
      aria-label={label}
    >
      {#if options.length === 0}
        <p class="px-2 py-1.5 text-xs text-text-muted">Nothing to filter by yet.</p>
      {:else}
        {#each options as option (option.value)}
          <button
            type="button"
            class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-surface-hover"
            role="checkbox"
            aria-checked={chosen.has(option.value)}
            onclick={() => toggle(option.value)}
          >
            <span
              class="flex size-3.5 shrink-0 items-center justify-center rounded-sm border
                     {chosen.has(option.value)
                ? 'border-accent bg-accent text-white'
                : 'border-border'}"
            >
              {#if chosen.has(option.value)}<Check size={10} />{/if}
            </span>
            <span class="truncate">{option.label}</span>
          </button>
        {/each}

        {#if selected.length > 0}
          <div class="mt-1 border-t border-border pt-1">
            <button
              type="button"
              class="w-full px-2 py-1 text-left text-xs text-text-muted hover:text-text"
              onclick={() => onchange([])}>Clear</button
            >
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
