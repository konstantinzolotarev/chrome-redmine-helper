import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import type { Issue } from '@/lib/redmine';
import { DEFAULT_ENUMS, DEFAULT_PREFS, DEFAULT_SECRETS, DEFAULT_SYNC_META } from '@/lib/store/defaults';
import {
  currentUserItem,
  enumsItem,
  issuesItem,
  prefsItem,
  readStateItem,
  secretsItem,
  syncMetaItem,
  timerItem,
} from '@/lib/store/items';

import App from './App.svelte';

function issue(id: number, over: Partial<Issue> = {}): Issue {
  return {
    id,
    subject: `Issue ${id}`,
    description: '',
    done_ratio: 0,
    updated_on: '2026-09-01T10:00:00Z',
    created_on: '2026-09-01T09:00:00Z',
    project: { id: 1, name: 'Sandbox' },
    tracker: { id: 1, name: 'Bug' },
    status: { id: 1, name: 'New' },
    priority: { id: 4, name: 'Normal' },
    author: { id: 1, name: 'Ada' },
    assigned_to: { id: 1, name: 'Ada' },
    ...over,
  } as Issue;
}

/** happy-dom ships no clipboard, and the direct user-event API installs none. */
function stubClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const clipboard = { writeText: vi.fn(async () => {}) };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  return clipboard;
}

describe('Side panel', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    // Opening an issue triggers a detail fetch. Without a stub the suite makes
    // real DNS lookups for redmine.test, which is slow and network-dependent.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        // Watcher writes answer 204 — which must carry a null body, not ''.
        if (url.includes('/watchers')) return new Response(null, { status: 204 });

        const match = /\/issues\/(\d+)\.json/.exec(url);
        const body = match
          ? { issue: { ...issue(Number(match[1])), journals: [], attachments: [], watchers: [] } }
          : {};
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    await prefsItem.setValue({ ...DEFAULT_PREFS, host: 'https://redmine.test' });
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: 'key' });
    await enumsItem.setValue({ ...DEFAULT_ENUMS });
    await syncMetaItem.setValue({ ...DEFAULT_SYNC_META });
    await currentUserItem.setValue({ id: 1, name: 'Ada' });
    await readStateItem.setValue({});
    await timerItem.setValue(null);
    await issuesItem.setValue({});
    await Promise.resolve();
  });

  async function seed(...list: Issue[]) {
    await issuesItem.setValue(Object.fromEntries(list.map((i) => [String(i.id), i])));
    await Promise.resolve();
  }

  it('prompts to connect when no host is configured', async () => {
    await prefsItem.setValue({ ...DEFAULT_PREFS, host: '' });
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: '' });
    render(App);

    expect(await screen.findByText('Not connected yet')).toBeInTheDocument();
  });

  it('lists issues with their project and status', async () => {
    await seed(issue(1), issue(2, { subject: 'Second thing' }));
    render(App);

    expect(await screen.findByText('Issue 1')).toBeInTheDocument();
    expect(screen.getByText('Second thing')).toBeInTheDocument();
    expect(screen.getAllByText('Sandbox')).toHaveLength(2);
  });

  it('shows an empty state when nothing is assigned', async () => {
    render(App);
    expect(await screen.findByText(/No issues assigned to you yet/)).toBeInTheDocument();
  });

  it('filters by subject and by id', async () => {
    await seed(issue(1, { subject: 'Login is broken' }), issue(2, { subject: 'Export to CSV' }));
    render(App);

    const search = await screen.findByLabelText('Search issues');
    await userEvent.type(search, 'login');

    expect(screen.getByText('Login is broken')).toBeInTheDocument();
    expect(screen.queryByText('Export to CSV')).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, '2');
    expect(await screen.findByText('Export to CSV')).toBeInTheDocument();
  });

  it('reports when a search matches nothing', async () => {
    await seed(issue(1));
    render(App);

    await userEvent.type(await screen.findByLabelText('Search issues'), 'zzzz');
    expect(await screen.findByText(/No issues match that search/)).toBeInTheDocument();
  });

  it('counts unread issues and clears them on mark-all-read', async () => {
    await seed(issue(1), issue(2));
    render(App);

    expect(await screen.findByText(/2 unread/)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Mark all read'));
    await waitFor(() => expect(screen.queryByText(/unread/)).not.toBeInTheDocument());
  });

  it('opens the detail view and marks that issue read', async () => {
    await seed(issue(1, { subject: 'Login is broken' }));
    render(App);

    await userEvent.click(await screen.findByText('Login is broken'));

    // Detail header shows the issue number and a link out to Redmine.
    expect(await screen.findByLabelText('Open in Redmine')).toHaveAttribute(
      'href',
      'https://redmine.test/issues/1',
    );

    await waitFor(async () => {
      expect(Object.keys(await readStateItem.getValue())).toContain('1');
    });
  });

  it('returns to the list from the detail view', async () => {
    await seed(issue(1));
    render(App);

    await userEvent.click(await screen.findByText('Issue 1'));
    await userEvent.click(await screen.findByLabelText('Back to the list'));

    expect(await screen.findByLabelText('Search issues')).toBeInTheDocument();
  });

  it('starts a timer and shows the running banner', async () => {
    await seed(issue(1, { subject: 'Login is broken' }));
    render(App);

    await userEvent.click(await screen.findByLabelText('Start tracking time on issue 1'));

    await waitFor(async () => {
      expect(await timerItem.getValue()).toMatchObject({ issueId: 1 });
    });
    expect(await screen.findByText(/Tracking/)).toBeInTheDocument();
  });

  it('starting a second timer stops the first', async () => {
    // v1 only closed a prior session for the same issue, so several could run.
    await seed(issue(1), issue(2));
    render(App);

    await userEvent.click(await screen.findByLabelText('Start tracking time on issue 1'));
    await waitFor(async () => expect(await timerItem.getValue()).toMatchObject({ issueId: 1 }));

    await userEvent.click(screen.getByLabelText('Start tracking time on issue 2'));
    await waitFor(async () => expect(await timerItem.getValue()).toMatchObject({ issueId: 2 }));
  });

  it('surfaces a sync failure from the worker', async () => {
    await syncMetaItem.setValue({
      ...DEFAULT_SYNC_META,
      lastErrorKind: 'unauthorized',
      lastErrorMessage: 'Redmine rejected the API key.',
      consecutiveFailures: 1,
    });
    render(App);

    expect(await screen.findByText('Sync failed')).toBeInTheDocument();
    expect(screen.getByText(/rejected the API key/)).toBeInTheDocument();
  });

  it('asks the worker to poll when refresh is pressed', async () => {
    const send = vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined as never);
    await seed(issue(1));
    render(App);

    await userEvent.click(await screen.findByLabelText('Refresh now'));
    expect(send).toHaveBeenCalledWith({ type: 'poll' });
  });

  it('watches an issue from the detail header, then unwatches it', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    await userEvent.click(await screen.findByText('Issue 1'));

    // The seeded issue has an empty watcher list, so the control offers to add.
    await userEvent.click(await screen.findByRole('button', { name: 'Watch this issue' }));

    const stop = await screen.findByRole('button', { name: 'Stop watching this issue' });
    const added = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).endsWith('/issues/1/watchers.json') && init?.method === 'POST',
      );
    expect(added).toBeDefined();
    expect(JSON.parse(String(added?.[1]?.body))).toEqual({ user_id: 1 });

    await userEvent.click(stop);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Watch this issue' })).toBeInTheDocument(),
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/issues/1/watchers/1.json') && init?.method === 'DELETE',
        ),
    ).toBe(true);
  });

  it('hides the watch control when Redmine withholds the watcher list', async () => {
    // Redmine omits `watchers` from users without view_issue_watchers, and a
    // toggle would have to guess which of add/remove to send.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ issue: { ...issue(1), journals: [], attachments: [] } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    await userEvent.click(await screen.findByText('Issue 1'));

    expect(await screen.findByRole('button', { name: 'Mark unread' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /watching|Watch this issue/ })).not.toBeInTheDocument();
  });

  it('copies an issue link from a card', async () => {
    const clipboard = stubClipboard();
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    await userEvent.click(await screen.findByRole('button', { name: 'Copy link to issue 1' }));

    expect(clipboard.writeText).toHaveBeenCalledWith('https://redmine.test/issues/1');
    expect(await screen.findByTitle('Copied')).toBeInTheDocument();
  });

  it('marks a watched issue, being one not assigned to me', async () => {
    await seed(issue(1, { assigned_to: { id: 99, name: 'Someone else' } }));
    render(App);

    const item = (await screen.findByText('Issue 1')).closest('li')!;
    expect(within(item).getByTitle('You are watching this issue')).toBeInTheDocument();
  });
});
