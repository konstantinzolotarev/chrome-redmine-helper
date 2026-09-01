import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Issue } from '@/lib/redmine';
import { issues, readState } from '@/lib/store/app.svelte';
import { DEFAULT_PREFS, DEFAULT_SECRETS } from '@/lib/store/defaults';
import { issuesItem, prefsItem, readStateItem, secretsItem } from '@/lib/store/items';

import { applyIssueChange, postComment } from './issues.svelte';

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: 1,
    subject: 'Original subject',
    description: '',
    done_ratio: 0,
    updated_on: '2026-09-01T10:00:00Z',
    created_on: '2026-09-01T09:00:00Z',
    project: { id: 1, name: 'Sandbox' },
    tracker: { id: 1, name: 'Bug' },
    status: { id: 1, name: 'New' },
    priority: { id: 4, name: 'Normal' },
    author: { id: 1, name: 'Ada' },
    ...over,
  } as Issue;
}

describe('applyIssueChange', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await prefsItem.setValue({ ...DEFAULT_PREFS, host: 'https://redmine.test' });
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: 'key' });
    await issuesItem.setValue({ '1': issue() });
    await readStateItem.setValue({});
    await Promise.resolve();
  });

  it('applies the change and re-reads the issue on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') return new Response(null, { status: 204 });
        return new Response(
          JSON.stringify({ issue: issue({ done_ratio: 40, updated_on: '2026-09-01T12:00:00Z' }) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    expect(await applyIssueChange(1, { done_ratio: 40 }, { done_ratio: 40 })).toBe(true);
    expect((await issuesItem.getValue())['1']!.done_ratio).toBe(40);
  });

  it('rolls the cache back when Redmine rejects the change', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errors: ['Done ratio is not included in the list'] }), {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    expect(await applyIssueChange(1, { done_ratio: 999 }, { done_ratio: 999 })).toBe(false);

    // The optimistic value must not survive the failure.
    const cached = (await issuesItem.getValue())['1']!;
    expect(cached.done_ratio).toBe(0);
    expect(cached.subject).toBe('Original subject');
  });

  it('rolls back a rejected subject edit too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));

    await applyIssueChange(1, { subject: 'New subject' }, { subject: 'New subject' });
    expect((await issuesItem.getValue())['1']!.subject).toBe('Original subject');
  });

  it('refuses to act when not connected', async () => {
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: '' });
    await Promise.resolve();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await applyIssueChange(1, { done_ratio: 10 }, { done_ratio: 10 })).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('postComment', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await prefsItem.setValue({ ...DEFAULT_PREFS, host: 'https://redmine.test' });
    await secretsItem.setValue({ ...DEFAULT_SECRETS, apiKey: 'key' });
    await issuesItem.setValue({ '1': issue() });
    await readStateItem.setValue({});
    await Promise.resolve();
  });

  it('marks the issue read after a successful comment', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PUT'
          ? new Response(null, { status: 204 })
          : new Response(JSON.stringify({ issue: issue() }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
      ),
    );

    expect(await postComment(1, 'Looks good')).toBe(true);
    // Having just replied, the user has plainly read it.
    expect(Object.keys(await readStateItem.getValue())).toContain('1');
  });

  it('reports a failure without marking it read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));

    expect(await postComment(1, 'Looks good')).toBe(false);
    expect(Object.keys(await readStateItem.getValue())).not.toContain('1');
  });
});

describe('store wiring', () => {
  it('exposes the same values the actions write', async () => {
    await issuesItem.setValue({ '1': issue({ subject: 'Via storage' }) });
    await readStateItem.setValue({ '1': '2026-09-01T11:00:00Z' });
    await Promise.resolve();

    expect(issues.current['1']?.subject).toBe('Via storage');
    expect(readState.current['1']).toBe('2026-09-01T11:00:00Z');
  });
});
