import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Issue } from '@/lib/redmine';
import {
  DEFAULT_ENUMS,
  DEFAULT_PREFS,
  DEFAULT_SECRETS,
  DEFAULT_SYNC_META,
} from '@/lib/store/defaults';
import {
  contextSelectionItem,
  currentUserItem,
  enumsItem,
  issuesItem,
  membersItem,
  prefsItem,
  projectsItem,
  readStateItem,
  secretsItem,
  syncMetaItem,
  timerItem,
  unsentSessionsItem,
} from '@/lib/store/items';
import type { UnsentSession } from '@/lib/store/types';

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

function session(over: Partial<UnsentSession> = {}): UnsentSession {
  return {
    id: 's1',
    issueId: 1,
    issueSubject: 'Issue 1',
    startedAt: '2026-09-01T09:00:00Z',
    endedAt: '2026-09-01T10:00:00Z',
    hours: 1,
    spentOn: '2026-09-01',
    activityId: null,
    comments: '',
    attempts: 0,
    lastError: null,
    ...over,
  };
}

/** happy-dom ships no clipboard, and the direct user-event API installs none. */
function stubClipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const clipboard = { writeText: vi.fn(async () => {}) };
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  return clipboard;
}

/** happy-dom updates location.hash but does not fire the event for it. */
function hashChanged(): void {
  globalThis.dispatchEvent(new HashChangeEvent('hashchange'));
}

describe('Tab page', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const detail = /\/issues\/(\d+)\.json/.exec(url);

        const body = detail
          ? { issue: { ...issue(Number(detail[1])), journals: [] } }
          : url.includes('/memberships.json')
            ? { memberships: [], total_count: 0, offset: 0, limit: 100 }
            : { news: [], total_count: 0, offset: 0, limit: 100 };

        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    globalThis.location.hash = '';
    await prefsItem.setValue({ ...DEFAULT_PREFS, host: 'https://redmine.test' });
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: 'key' });
    await enumsItem.setValue({ ...DEFAULT_ENUMS });
    await syncMetaItem.setValue({ ...DEFAULT_SYNC_META });
    await currentUserItem.setValue({ id: 1, name: 'Ada' });
    await issuesItem.setValue({});
    await readStateItem.setValue({});
    await projectsItem.setValue({});
    await membersItem.setValue({});
    await timerItem.setValue(null);
    await unsentSessionsItem.setValue([]);
    await contextSelectionItem.setValue('');
    await Promise.resolve();
  });

  it('defaults to the issues view', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    expect(await screen.findByLabelText('Search issues')).toBeInTheDocument();
    expect(screen.getByText('Issue 1')).toBeInTheDocument();
  });

  it('honours the hash route on load', async () => {
    globalThis.location.hash = '#/projects';
    render(App);

    expect(await screen.findByRole('button', { name: /Refresh projects/ })).toBeInTheDocument();
  });

  it('navigates when the hash changes', async () => {
    render(App);
    expect(await screen.findByLabelText('Search issues')).toBeInTheDocument();

    globalThis.location.hash = '#/time';
    globalThis.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(await screen.findByText('Waiting to be logged')).toBeInTheDocument();
  });

  it('still honours v1\'s #/new-issue deep link from the context menu', async () => {
    globalThis.location.hash = '#/new-issue';
    render(App);

    expect(await screen.findByLabelText('Subject')).toBeInTheDocument();
  });

  it('prefills the new issue form from the context-menu selection', async () => {
    // v1 kept this in a background-page global, which MV3 discards (D8).
    await contextSelectionItem.setValue('Broken login\nSteps to reproduce here');
    globalThis.location.hash = '#/new-issue';
    render(App);

    await waitFor(() => {
      expect(screen.getByLabelText('Subject')).toHaveValue('Broken login');
      expect(screen.getByLabelText('Description')).toHaveValue('Steps to reproduce here');
    });

    // Consumed, so reopening the page does not refill it.
    await waitFor(async () => expect(await contextSelectionItem.getValue()).toBe(''));
  });

  it('shows the queued-time badge in the nav', async () => {
    await unsentSessionsItem.setValue([session(), session({ id: 's2' })]);
    render(App);

    const link = await screen.findByRole('link', { name: /Time log/ });
    expect(link).toHaveTextContent('2');
  });

  it('lists queued sessions with their failure reason', async () => {
    await unsentSessionsItem.setValue([
      session({ attempts: 2, lastError: 'Redmine rejected the API key.' }),
    ]);
    globalThis.location.hash = '#/time';
    render(App);

    expect(await screen.findByText(/#1 Issue 1/)).toBeInTheDocument();
    expect(screen.getByText(/Attempt 2: Redmine rejected the API key./)).toBeInTheDocument();
  });

  it('discards a queued session on request', async () => {
    await unsentSessionsItem.setValue([session()]);
    globalThis.location.hash = '#/time';
    render(App);

    await userEvent.click(await screen.findByRole('button', { name: /Discard/ }));
    await waitFor(async () => expect(await unsentSessionsItem.getValue()).toHaveLength(0));
  });

  it('respects the configured columns', async () => {
    await prefsItem.setValue({
      ...DEFAULT_PREFS,
      host: 'https://redmine.test',
      columns: { id: false, project: false, author: false, tracker: true, status: true },
    });
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    expect(await screen.findByRole('columnheader', { name: 'Tracker' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '#' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Project' })).not.toBeInTheDocument();
  });

  it('prompts to connect when unconfigured', async () => {
    await prefsItem.setValue({ ...DEFAULT_PREFS, host: '' });
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: '' });
    render(App);

    expect(await screen.findByText('Not connected yet')).toBeInTheDocument();
  });

  it('routes subjects into the detail pane, with Redmine on its own icon', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    // The subject used to carry the absolute URL and leave the extension.
    expect(await screen.findByRole('link', { name: 'Issue 1' })).toHaveAttribute(
      'href',
      '#/issues/1',
    );
    expect(screen.getByRole('link', { name: 'Open issue 1 in Redmine' })).toHaveAttribute(
      'href',
      'https://redmine.test/issues/1',
    );
  });

  it('opens the detail pane from a subject click and marks the issue read', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    await userEvent.click(await screen.findByRole('link', { name: 'Issue 1' }));
    hashChanged();

    expect(await screen.findByRole('heading', { name: 'Issue 1' })).toBeInTheDocument();
    await waitFor(async () => expect(await readStateItem.getValue()).toHaveProperty('1'));
  });

  it('renders the detail pane for a deep-linked issue, keeping Issues selected', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    globalThis.location.hash = '#/issues/1';
    render(App);

    expect(await screen.findByRole('heading', { name: 'Issue 1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Issues/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('closes the pane on back, returning to the plain list', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    globalThis.location.hash = '#/issues/1';
    render(App);

    await userEvent.click(await screen.findByRole('button', { name: 'Back to the list' }));
    hashChanged();

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Issue 1' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'Issue 1' })).toBeInTheDocument();
  });

  it('explains a deep link to an issue that is no longer cached', async () => {
    globalThis.location.hash = '#/issues/999';
    render(App);

    expect(await screen.findByText(/isn't in your list/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open #999 in Redmine/ })).toHaveAttribute(
      'href',
      'https://redmine.test/issues/999',
    );
  });

  it('copies an issue link from a row', async () => {
    const clipboard = stubClipboard();
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    await userEvent.click(await screen.findByRole('button', { name: 'Copy link to issue 1' }));

    expect(clipboard.writeText).toHaveBeenCalledWith('https://redmine.test/issues/1');
    expect(await screen.findByTitle('Copied')).toBeInTheDocument();
  });

  it('starts and stops a timer from a row', async () => {
    await issuesItem.setValue({ '1': issue(1) });
    render(App);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Start tracking time on issue 1' }),
    );

    await waitFor(async () => expect(await timerItem.getValue()).toMatchObject({ issueId: 1 }));
    expect(await screen.findByText(/Tracking/)).toBeInTheDocument();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Stop tracking time on issue 1' }),
    );
    await waitFor(async () => expect(await timerItem.getValue()).toBeNull());
  });
});
