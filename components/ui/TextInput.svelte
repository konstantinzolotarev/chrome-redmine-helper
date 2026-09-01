<script lang="ts">
  interface Props {
    id?: string;
    value: string;
    type?: 'text' | 'password' | 'url' | 'number' | 'date';
    placeholder?: string;
    disabled?: boolean;
    step?: string;
    min?: string;
    max?: string;
    oninput?: () => void;
  }

  let {
    id,
    value = $bindable(),
    type = 'text',
    placeholder,
    disabled = false,
    step,
    min,
    max,
    oninput,
  }: Props = $props();
</script>

<input
  {id}
  {type}
  {placeholder}
  {disabled}
  {step}
  {min}
  {max}
  bind:value
  {oninput}
  class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs focus:border-accent disabled:opacity-50"
/>
