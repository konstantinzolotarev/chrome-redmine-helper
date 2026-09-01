<script lang="ts">
  import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-svelte';

  interface Props {
    tone?: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    hint?: string;
  }

  let { tone = 'info', title, message, hint }: Props = $props();

  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  } as const;

  const tones = {
    info: 'border-border bg-surface-2 text-text',
    success: 'border-success/40 bg-success/10 text-text',
    warning: 'border-warning/40 bg-warning/10 text-text',
    error: 'border-danger/40 bg-danger/10 text-text',
  } as const;

  const iconTones = {
    info: 'text-text-muted',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-danger',
  } as const;

  const Icon = $derived(icons[tone]);
</script>

<div class="flex gap-2 rounded-md border p-3 {tones[tone]}" role={tone === 'error' ? 'alert' : 'status'}>
  <span class="mt-px shrink-0 {iconTones[tone]}"><Icon size={15} /></span>
  <div class="min-w-0">
    <p class="text-xs font-semibold">{title}</p>
    {#if message}
      <p class="mt-0.5 text-xs whitespace-pre-line">{message}</p>
    {/if}
    {#if hint}
      <p class="mt-1 text-xs text-text-muted">{hint}</p>
    {/if}
  </div>
</div>
