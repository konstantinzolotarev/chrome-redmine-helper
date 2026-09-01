<script lang="ts">
  import { LoaderCircle } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    loading?: boolean;
    title?: string;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'secondary',
    type = 'button',
    disabled = false,
    loading = false,
    title,
    onclick,
    children,
  }: Props = $props();

  const variants = {
    primary: 'bg-accent text-accent-text hover:opacity-90',
    secondary: 'border border-border bg-surface hover:bg-surface-hover',
    danger: 'border border-danger/50 text-danger hover:bg-danger/10',
    ghost: 'text-text-muted hover:bg-surface-hover hover:text-text',
  } as const;
</script>

<button
  {type}
  {title}
  disabled={disabled || loading}
  {onclick}
  class="inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
         transition-opacity disabled:cursor-not-allowed disabled:opacity-50 {variants[variant]}"
>
  {#if loading}
    <span class="animate-spin"><LoaderCircle size={13} /></span>
  {/if}
  {@render children()}
</button>
