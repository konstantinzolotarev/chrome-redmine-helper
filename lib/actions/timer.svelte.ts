import { currentClient } from '@/lib/client.svelte';
import { createTimeEntry, isRedmineError } from '@/lib/redmine';
import { prefs, timer, unsentSessions } from '@/lib/store/app.svelte';
import type { TimerState, UnsentSession } from '@/lib/store/types';
import { toast } from '@/lib/store/ui.svelte';
import { elapsedMs, hoursFromMs, localDateIso, roundHours } from '@/lib/time';

/**
 * Timers are a stored `startedAt` and nothing else — elapsed time is computed
 * on read. There is no interval anywhere: an MV3 service worker is torn down
 * after ~30 seconds idle, so a ticking counter could not survive.
 *
 * A single global timer: starting one stops the other. v1 only closed a prior
 * session for the *same* issue, so timers on several issues could silently run
 * at once.
 */

export async function startTimer(issueId: number, issueSubject: string): Promise<void> {
  const running = timer.current;
  if (running && running.issueId !== issueId) {
    await stopTimer();
  }

  await timer.set({ issueId, issueSubject, startedAt: new Date().toISOString() });
}

/** Stop the timer and queue the session. Returns it so the UI can offer the log form. */
export async function stopTimer(): Promise<UnsentSession | null> {
  const running = timer.current;
  if (!running) return null;

  const session = toSession(running, new Date(), prefs.current.timeRoundingHours);
  await timer.set(null);

  if (session.hours <= 0) return null;

  await unsentSessions.update((queue) => [...queue, session]);
  return session;
}

export async function cancelTimer(): Promise<void> {
  await timer.set(null);
}

export function toSession(
  running: TimerState,
  endedAt: Date,
  roundingHours: number,
  newId: () => string = () => crypto.randomUUID(),
): UnsentSession {
  const ms = elapsedMs(running.startedAt, endedAt.getTime());

  return {
    id: newId(),
    issueId: running.issueId,
    issueSubject: running.issueSubject,
    startedAt: running.startedAt,
    endedAt: endedAt.toISOString(),
    hours: roundHours(hoursFromMs(ms), roundingHours),
    spentOn: localDateIso(new Date(running.startedAt)),
    activityId: null,
    comments: '',
    attempts: 0,
    lastError: null,
  };
}

/**
 * Send a queued session to Redmine, removing it from the queue on success.
 *
 * A failure keeps it queued with the reason attached, so nothing tracked is
 * ever lost to a dropped connection.
 */
export async function logSession(
  session: UnsentSession,
  overrides: Partial<Pick<UnsentSession, 'hours' | 'spentOn' | 'activityId' | 'comments'>> = {},
): Promise<boolean> {
  const client = currentClient();
  if (!client) {
    toast.show('error', 'Not connected to Redmine yet.');
    return false;
  }

  const entry = { ...session, ...overrides };

  try {
    await createTimeEntry(client, {
      issue_id: entry.issueId,
      hours: entry.hours,
      spent_on: entry.spentOn,
      activity_id: entry.activityId ?? undefined,
      comments: entry.comments,
    });

    await unsentSessions.update((queue) => queue.filter((item) => item.id !== session.id));
    toast.show('success', `Logged ${entry.hours}h on #${entry.issueId}.`);
    return true;
  } catch (error) {
    const message = isRedmineError(error) ? error.describe() : String(error);
    await unsentSessions.update((queue) =>
      queue.map((item) =>
        item.id === session.id
          ? { ...item, ...overrides, attempts: item.attempts + 1, lastError: message }
          : item,
      ),
    );
    toast.show('error', message);
    return false;
  }
}

export async function discardSession(id: string): Promise<void> {
  await unsentSessions.update((queue) => queue.filter((item) => item.id !== id));
}
