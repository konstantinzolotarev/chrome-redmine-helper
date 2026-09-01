<script lang="ts">
  interface Props {
    checked: boolean;
    label: string;
    disabled?: boolean;
    onchange?: () => void;
  }

  let { checked = $bindable(), label, disabled = false, onchange }: Props = $props();
</script>

<label class="flex cursor-pointer items-center gap-2 text-xs" class:opacity-50={disabled}>
  <input type="checkbox" bind:checked {disabled} {onchange} class="accent-accent" />
  {label}
</label>
