import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

import { migrateFromV1 } from '@/lib/migrate/v1';
import { openTabPage } from '@/lib/pages';
import { MIN_POLL_INTERVAL_MINUTES } from '@/lib/store/defaults';
import { contextSelectionItem, prefsItem } from '@/lib/store/items';
import { issueIdFromNotification } from '@/lib/sync/notify';
import { runPoll } from '@/lib/sync/poller';

const POLL_ALARM = 'poll';
const CONTEXT_MENU_ID = 'newIssueFromSelection';

async function schedulePolling(): Promise<void> {
  const { pollIntervalMinutes } = await prefsItem.getValue();
  const periodInMinutes = Math.max(pollIntervalMinutes, MIN_POLL_INTERVAL_MINUTES);

  // A periodic alarm, rather than v1's pattern of clearing and recreating a
  // one-shot alarm at the end of every request.
  await browser.alarms.create(POLL_ALARM, { periodInMinutes, delayInMinutes: periodInMinutes });
}

async function installContextMenu(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Create new Redmine issue',
    contexts: ['selection'],
  });
}

export default defineBackground({
  type: 'module',
  // `main` cannot be async: WXT evaluates this module at build time to generate
  // the manifest, and the worker needs its listeners registered synchronously so
  // events that wake it are not missed.
  main() {
    // Clicking the toolbar icon opens the side panel rather than a tab.
    browser.sidePanel
      ?.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: unknown) => console.error('[redmine-helper] side panel behavior', error));

    browser.runtime.onInstalled.addListener((details) => {
      void (async () => {
        if (details.reason === 'update' || details.reason === 'install') {
          // Carries 1.6.6 settings and any time tracked but never logged.
          const result = await migrateFromV1();
          if (result.migrated) {
            console.info(
              `[redmine-helper] migrated from v1 (${result.carriedSessions} tracked session(s) carried over)`,
            );
          }
        }

        await installContextMenu();
        await schedulePolling();

        const { host } = await prefsItem.getValue();
        if (details.reason === 'install' && !host) {
          await browser.runtime.openOptionsPage();
        } else {
          await runPoll({ force: true });
        }
      })();
    });

    browser.runtime.onStartup.addListener(() => {
      void (async () => {
        await installContextMenu();
        await schedulePolling();
        await runPoll({ force: true });
      })();
    });

    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== POLL_ALARM) return;
      // Returning nothing is fine: the alarm event keeps the worker alive while
      // this promise is pending.
      void runPoll();
    });

    // Reconfiguring the connection should take effect immediately, not on the
    // next tick of a five-minute alarm.
    prefsItem.watch(() => {
      void (async () => {
        await schedulePolling();
        await runPoll({ force: true });
      })();
    });

    browser.contextMenus.onClicked.addListener((info) => {
      if (info.menuItemId !== CONTEXT_MENU_ID) return;
      void (async () => {
        // Session storage, not a worker global: v1 kept this in `var selectedText`
        // on the background page, which MV3 discards on every teardown (D8).
        await contextSelectionItem.setValue(info.selectionText ?? '');
        await openTabPage('/new-issue');
      })();
    });

    // The side panel's refresh button asks the worker to poll, rather than
    // duplicating the delta logic in the UI.
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if ((message as { type?: string } | null)?.type !== 'poll') return false;
      runPoll({ force: true }).then(sendResponse, (error: unknown) =>
        sendResponse({ status: 'error', error: String(error) }),
      );
      // Keep the message channel open for the async reply.
      return true;
    });

    browser.notifications.onClicked.addListener((notificationId) => {
      void (async () => {
        const issueId = issueIdFromNotification(notificationId);
        // Routed to the tab page rather than the side panel: `sidePanel.open()`
        // requires a user gesture, and whether a notification click qualifies is
        // unverified (see O1 in the plan).
        await openTabPage(issueId ? `/issues/${issueId}` : '/issues');
        await browser.notifications.clear(notificationId);
      })();
    });
  },
});
