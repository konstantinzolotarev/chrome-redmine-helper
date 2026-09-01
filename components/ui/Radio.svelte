<script lang="ts">
  interface Props {
    name: string;
    value: string;
    /** Controlled: the parent owns the state and persists it in `onchange`. */
    checked: boolean;
    label: string;
    hint?: string;
    onchange?: () => void;
  }

  let { name, value, checked, label, hint, onchange }: Props = $props();
</script>

<label class="flex cursor-pointer items-start gap-2 text-xs">
  <input type="radio" {name} {value} {checked} {onchange} class="mt-0.5 accent-accent" />
  <span>
    {label}
    {#if hint}
      <span class="block text-text-muted">{hint}</span>
    {/if}
  </span>
</label>
