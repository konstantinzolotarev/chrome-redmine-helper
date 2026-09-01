<script lang="ts">
  interface Props {
    value: string | null | undefined;
    prefix?: string;
  }

  let { value, prefix = '' }: Props = $props();

  const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const relative = $derived.by(() => {
    if (!value) return '';
    const time = Date.parse(value);
    if (Number.isNaN(time)) return '';

    const diff = time - Date.now();
    for (const [unit, ms] of UNITS) {
      if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
    }
    return 'just now';
  });

  const absolute = $derived(value ? new Date(value).toLocaleString() : '');
</script>

<time datetime={value ?? undefined} title={absolute}>{prefix}{relative}</time>
