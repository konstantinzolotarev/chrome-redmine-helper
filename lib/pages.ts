import { browser } from 'wxt/browser';

/**
 * Open (or focus, if already open) the full tab page at the given hash route.
 *
 * Replaces v1's `openMainPage()`, which used the removed
 * `chrome.tabs.getAllInWindow` and `chrome.extension.getURL`.
 */
export async function openTabPage(route = '/issues'): Promise<void> {
  const base = browser.runtime.getURL('/app.html');
  const url = `${base}#${route.replace(/^#/, '')}`;

  const existing = await browser.tabs.query({ url: `${base}*` });
  const tab = existing[0];

  if (tab?.id != null) {
    await browser.tabs.update(tab.id, { active: true, url });
    if (tab.windowId != null) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
    return;
  }

  await browser.tabs.create({ url });
}
