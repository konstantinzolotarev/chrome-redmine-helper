import { browser } from 'wxt/browser';

import { badgeText } from '@/lib/store/derive';

const UNREAD_COLOR = '#3b6fd4';
const ERROR_COLOR = '#c0392b';

export async function setUnreadBadge(count: number): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color: UNREAD_COLOR });
  await browser.action.setBadgeText({ text: badgeText(count) });
  await browser.action.setTitle({
    title: count > 0 ? `Redmine Helper — ${count} unread` : 'Redmine Helper',
  });
}

export async function setErrorBadge(message: string): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color: ERROR_COLOR });
  await browser.action.setBadgeText({ text: '!' });
  await browser.action.setTitle({ title: `Redmine Helper — ${message}` });
}
