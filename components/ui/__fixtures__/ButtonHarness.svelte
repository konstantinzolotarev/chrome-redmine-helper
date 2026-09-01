<!--
  Test harness: Button takes a `children` snippet, which cannot be supplied
  through Testing Library's plain props object — so a wrapper declares it.
-->
<script lang="ts">
  import Button from '../Button.svelte';

  interface Props {
    label: string;
    loading?: boolean;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
  }

  let { label, loading = false, disabled = false, onclick }: Props = $props();
</script>

<Button {loading} {disabled} {onclick}>
  {#snippet children()}{label}{/snippet}
</Button>
