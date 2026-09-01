import { browser } from 'wxt/browser';

import type { Issue } from '@/lib/redmine';
import type { NotificationMode } from '@/lib/store/types';

/**
 * Desktop notifications.
 *
 * v1 used `webkitNotifications`, removed from Chrome years ago, and cancelled
 * each one via a `chrome.alarms` entry. `chrome.notifications` handles dismissal
 * itself.
 */

const ICON = '/icon/48.png';

/** Encodes the target so the click handler knows where to navigate. */
function notificationId(issues: Issue[]): string {
  return issues.length === 1 ? `issue:${issues[0]!.id}` : 'issues';
}

export function issueIdFromNotification(id: string): number | null {
  const match = /^issue:(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export async function notifyIssues(
  mode: NotificationMode,
  created: Issue[],
  updated: Issue[],
): Promise<void> {
  if (mode === 'none') return;

  // `new` means only newly-appeared issues; `updated` means both.
  const subjects = mode === 'new' ? created : [...created, ...updated];
  if (subjects.length === 0) return;

  const single = subjects.length === 1;

  try {
    await browser.notifications.create(notificationId(subjects), {
      type: 'basic',
      iconUrl: browser.runtime.getURL(ICON),
      title: single ? 'Redmine issue updated' : `${subjects.length} Redmine issues updated`,
      message: single
        ? `#${subjects[0]!.id} ${subjects[0]!.subject}`
        : subjects
            .slice(0, 3)
            .map((issue) => `#${issue.id} ${issue.subject}`)
            .join('\n'),
    });
  } catch (error) {
    // Notifications are a nicety; never let them break a poll.
    console.warn('[redmine-helper] notification failed', error);
  }
}
