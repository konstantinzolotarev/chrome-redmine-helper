/** Duration and date helpers shared by the timer, the log form and migration. */

export function elapsedMs(startedAt: string, now: number = Date.now()): number {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, now - start);
}

export function hoursFromMs(ms: number): number {
  return ms / 3_600_000;
}

/**
 * Round to a logging increment.
 *
 * Never rounds down to zero: any session worth stopping is worth at least one
 * increment, and a silently discarded 0h entry is worse than a slightly
 * generous one. An increment of 0 means "no rounding".
 */
export function roundHours(hours: number, increment: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (increment <= 0) return Number(hours.toFixed(2));
  return Number((Math.max(1, Math.round(hours / increment)) * increment).toFixed(2));
}

/** `1h 23m`, `45m`, `12s`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

/**
 * `YYYY-MM-DD` in the viewer's own timezone.
 *
 * Not `toISOString().slice(0, 10)`: that is UTC, so anyone east of Greenwich
 * logging late in the evening would have the entry land on the following day —
 * and anyone west of it, in the morning, on the previous one.
 */
export function localDateIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
