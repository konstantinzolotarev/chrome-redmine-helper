/**
 * Load the built extension in the real Chrome and check every page mounts
 * without runtime errors.
 *
 * Typecheck and unit tests cannot catch a Svelte runtime failure or a worker
 * that throws on startup — this can. Uses the installed Chrome via
 * playwright-core, so there is no browser download.
 *
 *   npm run build && node dev/smoke.mjs [--headed] [--channel=chromium]
 *
 * Requires a browser that still honours `--load-extension`. Chrome 151 removed
 * that switch from stable (the DisableLoadExtensionCommandLineSwitch feature
 * flag no longer brings it back), so this needs Playwright's bundled Chromium:
 *
 *   npx playwright install chromium && node dev/smoke.mjs --channel=chromium
 *
 * Loading the extension by hand at chrome://extensions is unaffected — only the
 * command-line switch was removed.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionPath = join(root, '.output/chrome-mv3');
const userDataDir = mkdtempSync(join(tmpdir(), 'redmine-helper-smoke-'));
const headed = process.argv.includes('--headed');
const channelArg = process.argv.find((arg) => arg.startsWith('--channel='));
// `chromium` selects Playwright's own build, which still allows --load-extension.
const channel = channelArg ? channelArg.split('=')[1] : 'chrome';

const problems = [];
const record = (where, message) => problems.push(`${where}: ${message}`);

const context = await chromium.launchPersistentContext(userDataDir, {
  ...(channel === 'chromium' ? {} : { channel }),
  headless: !headed,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    // Chrome disabled --load-extension behind this feature flag; without
    // switching it off the extension silently never loads and every
    // chrome-extension:// navigation fails with ERR_BLOCKED_BY_CLIENT.
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
  ],
});

/**
 * Chrome derives an unpacked extension's id from a SHA-256 of its absolute
 * path: the first 32 hex digits, each mapped onto a-p.
 *
 * Computed rather than read off the service worker, because an MV3 worker is
 * event-driven and may not have started yet when the browser finishes launching.
 */
function unpackedExtensionId(absolutePath) {
  const digest = createHash('sha256').update(absolutePath, 'utf8').digest('hex').slice(0, 32);
  return [...digest].map((nibble) => String.fromCharCode(97 + Number.parseInt(nibble, 16))).join('');
}

try {
  const extensionId = unpackedExtensionId(extensionPath);

  // Confirm the browser actually loaded it, rather than letting every
  // navigation fail later with an opaque ERR_BLOCKED_BY_CLIENT.
  const probe = await context.newPage();
  await probe.goto('chrome://extensions-internals/', { waitUntil: 'load' });
  const loaded = await probe.evaluate(() => {
    try {
      return JSON.parse(document.body.innerText).map((entry) => entry.id);
    } catch {
      return [];
    }
  });
  await probe.close();

  if (!loaded.includes(extensionId)) {
    console.error(
      [
        `The browser did not load the extension at ${extensionPath}.`,
        '',
        'Chrome 151 removed the --load-extension command-line switch from stable,',
        'so this harness needs a browser that still supports it:',
        '',
        '  npx playwright install chromium',
        '  node dev/smoke.mjs --channel=chromium',
        '',
        'Loading it by hand at chrome://extensions still works and is unaffected.',
      ].join('\n'),
    );
    process.exitCode = 1;
    throw new Error('extension not loaded');
  }

  console.log(`extension id: ${extensionId}`);

  const attachWorkerLogging = () => {
    for (const worker of context.serviceWorkers()) {
      worker.on('console', (message) => {
        if (message.type() === 'error') record('worker console', message.text());
      });
    }
  };
  context.on('serviceworker', attachWorkerLogging);
  attachWorkerLogging();

  for (const page of ['options.html', 'sidepanel.html', 'app.html']) {
    const tab = await context.newPage();
    const seen = [];

    tab.on('console', (message) => {
      if (message.type() === 'error') seen.push(message.text());
    });
    tab.on('pageerror', (error) => seen.push(String(error)));

    await tab.goto(`chrome-extension://${extensionId}/${page}`, { waitUntil: 'load' });
    // Give Svelte a tick to mount and effects to settle.
    await tab.waitForTimeout(600);

    const mounted = await tab.evaluate(() => {
      const app = document.getElementById('app');
      return { exists: Boolean(app), children: app?.childElementCount ?? 0, text: document.body.innerText.slice(0, 120) };
    });

    if (!mounted.exists) record(page, 'no #app element');
    else if (mounted.children === 0) record(page, 'Svelte mounted nothing into #app');
    for (const error of seen) record(page, error);

    console.log(
      `${mounted.children > 0 && seen.length === 0 ? 'ok  ' : 'FAIL'} ${page.padEnd(15)} ${JSON.stringify(mounted.text.replace(/\s+/g, ' ').trim().slice(0, 70))}`,
    );
    await tab.close();
  }
  const workers = context.serviceWorkers();
  console.log(
    workers.length > 0
      ? `service worker running: ${workers[0].url().split('/').pop()}`
      : 'note: service worker not running (MV3 workers start on demand)',
  );
} finally {
  await context.close();
  rmSync(userDataDir, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('\nAll extension pages mounted cleanly.');
