import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import { DEFAULT_PREFS, DEFAULT_SECRETS } from '@/lib/store/defaults';
import { prefsItem, projectsItem, secretsItem } from '@/lib/store/items';

import App from './App.svelte';

describe('Options page', () => {
  /**
   * The reactive stores are module-level singletons, so their `$state` outlives
   * any single test. `vi.resetModules()` cannot be used to get around that —
   * it detaches @wxt-dev/storage from the fake browser — so isolation comes from
   * resetting the underlying storage instead, which the singletons observe via
   * their `storage.onChanged` subscription.
   */
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await prefsItem.setValue({ ...DEFAULT_PREFS });
    await secretsItem.setValue({ ...DEFAULT_SECRETS });
    await projectsItem.setValue({});
    // Let the watch callbacks land before a component reads the stores.
    await Promise.resolve();
  });

  const grantPermission = (granted: boolean) =>
    vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(granted as never);

  const stubFetch = (response: () => Response) =>
    vi.stubGlobal('fetch', vi.fn(async () => response()));

  const okUser = () =>
    new Response(JSON.stringify({ user: { id: 1, firstname: 'Ada', lastname: 'Lovelace' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  it('renders every settings section', async () => {
    render(App);

    expect(await screen.findByRole('heading', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Display' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stored data' })).toBeInTheDocument();
  });

  it('seeds the connection fields from stored settings', async () => {
    await prefsItem.setValue({ ...(await prefsItem.getValue()), host: 'https://redmine.test' });
    await secretsItem.setValue({ apiKey: 'stored-key', httpPassword: '' });

    render(App);

    await waitFor(() => {
      expect(screen.getByLabelText('Redmine host')).toHaveValue('https://redmine.test');
      expect(screen.getByLabelText(/API access key/)).toHaveValue('stored-key');
    });
  });

  it('requests host permission, then saves on success', async () => {
    const request = grantPermission(true);
    stubFetch(okUser);
    render(App);

    await userEvent.type(await screen.findByLabelText('Redmine host'), 'https://redmine.test');
    await userEvent.type(screen.getByLabelText(/API access key/), 'my-key');
    await userEvent.click(screen.getByRole('button', { name: /Save & test/ }));

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();

    // Permission is requested for the specific origin, not for <all_urls>.
    expect(request).toHaveBeenCalledWith({ origins: ['https://redmine.test/*'] });

    await waitFor(async () => {
      expect((await prefsItem.getValue()).host).toBe('https://redmine.test');
      expect((await secretsItem.getValue()).apiKey).toBe('my-key');
    });
  });

  it('does not save when permission is refused', async () => {
    grantPermission(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(App);

    await userEvent.type(await screen.findByLabelText('Redmine host'), 'https://redmine.test');
    await userEvent.type(screen.getByLabelText(/API access key/), 'my-key');
    await userEvent.click(screen.getByRole('button', { name: /Save & test/ }));

    expect(await screen.findByText(/was not granted/)).toBeInTheDocument();
    // No request should be attempted without permission.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await secretsItem.getValue()).apiKey).toBe('');
  });

  it('explains a rejected API key and keeps the old settings', async () => {
    grantPermission(true);
    stubFetch(() => new Response('{}', { status: 401 }));
    render(App);

    await userEvent.type(await screen.findByLabelText('Redmine host'), 'https://redmine.test');
    await userEvent.type(screen.getByLabelText(/API access key/), 'wrong-key');
    await userEvent.click(screen.getByRole('button', { name: /Save & test/ }));

    expect(await screen.findByText(/rejected the API key/)).toBeInTheDocument();
    expect((await secretsItem.getValue()).apiKey).toBe('');
  });

  it('points at the REST API setting when Redmine returns 403', async () => {
    grantPermission(true);
    stubFetch(() => new Response('{}', { status: 403 }));
    render(App);

    await userEvent.type(await screen.findByLabelText('Redmine host'), 'https://redmine.test');
    await userEvent.type(screen.getByLabelText(/API access key/), 'key');
    await userEvent.click(screen.getByRole('button', { name: /Save & test/ }));

    expect(await screen.findByText(/Administration → Settings → API/)).toBeInTheDocument();
  });

  it('rejects an invalid host before asking for permission', async () => {
    const request = grantPermission(true);
    render(App);

    await userEvent.type(await screen.findByLabelText('Redmine host'), 'ht!tp://%%%');
    await userEvent.type(screen.getByLabelText(/API access key/), 'key');
    await userEvent.click(screen.getByRole('button', { name: /Save & test/ }));

    expect(await screen.findByText(/not a valid URL/)).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('reveals HTTP Basic fields only when enabled', async () => {
    render(App);

    expect(screen.queryByLabelText('HTTP username')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText(/HTTP Basic/));
    expect(await screen.findByLabelText('HTTP username')).toBeInTheDocument();
  });

  it('persists the notification mode', async () => {
    render(App);

    await userEvent.click(await screen.findByLabelText(/For new and updated issues/));
    await waitFor(async () => {
      expect((await prefsItem.getValue()).notifications.mode).toBe('updated');
    });
  });

  it('clamps the poll interval to Chrome\'s one-minute floor', async () => {
    render(App);

    const input = await screen.findByLabelText(/Check every/);
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.tab();

    await waitFor(async () => {
      expect((await prefsItem.getValue()).pollIntervalMinutes).toBe(1);
    });
  });

  it('shows the project picker only when filtering is on', async () => {
    render(App);

    expect(screen.queryByRole('button', { name: /Load projects/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByLabelText(/Only the projects I pick/));
    expect(await screen.findByRole('button', { name: /Load projects/ })).toBeInTheDocument();
  });
});
