<script lang="ts">
  import { Database, Eye, FolderTree, Plug, Bell, Trash2 } from 'lucide-svelte';
  import { browser } from 'wxt/browser';

  import Banner from '@/components/ui/Banner.svelte';
  import Button from '@/components/ui/Button.svelte';
  import Checkbox from '@/components/ui/Checkbox.svelte';
  import Field from '@/components/ui/Field.svelte';
  import Radio from '@/components/ui/Radio.svelte';
  import Section from '@/components/ui/Section.svelte';
  import TextInput from '@/components/ui/TextInput.svelte';
  import {
    listProjects,
    originPattern,
    RedmineClient,
    testConnection,
    type ConnectionResult,
  } from '@/lib/redmine';
  import { prefs, projects, secrets } from '@/lib/store/app.svelte';
  import { MIN_POLL_INTERVAL_MINUTES } from '@/lib/store/defaults';
  import {
    enumsItem,
    issuesItem,
    projectsItem,
    readStateItem,
    syncMetaItem,
  } from '@/lib/store/items';
  import type { Prefs } from '@/lib/store/types';
  import { useTheme } from '@/lib/theme.svelte';

  useTheme();

  let draft = $state({
    host: '',
    apiKey: '',
    useHttpAuth: false,
    httpUser: '',
    httpPassword: '',
  });
  let initialized = $state(false);
  let testing = $state(false);
  let result = $state<ConnectionResult | null>(null);
  let loadingProjects = $state(false);
  let cleared = $state('');

  // Seed the connection draft once, when storage has finished loading.
  $effect(() => {
    if (initialized || prefs.loading || secrets.loading) return;
    draft = {
      host: prefs.current.host,
      apiKey: secrets.current.apiKey,
      useHttpAuth: prefs.current.useHttpAuth,
      httpUser: prefs.current.httpUser,
      httpPassword: secrets.current.httpPassword,
    };
    initialized = true;
  });

  function updatePrefs(patch: Partial<Prefs>) {
    void prefs.update((current) => ({ ...current, ...patch }));
  }

  function setPollInterval(raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    // Chrome silently refuses alarm periods below one minute.
    updatePrefs({ pollIntervalMinutes: Math.min(1440, Math.max(MIN_POLL_INTERVAL_MINUTES, Math.round(parsed))) });
  }

  async function saveAndTest() {
    result = null;

    let origin: string;
    try {
      origin = originPattern(draft.host);
    } catch {
      result = {
        ok: false,
        kind: 'invalid-host',
        message: 'That host is not a valid URL.',
        hint: 'Use the root URL of your Redmine, for example https://redmine.example.com',
      };
      return;
    }

    testing = true;
    try {
      // Must be the first await in this handler: permissions.request() requires
      // an active user gesture, and awaiting anything else first discards it.
      const granted = await browser.permissions.request({ origins: [origin] });
      if (!granted) {
        result = {
          ok: false,
          kind: 'no-permission',
          message: 'Access to that host was not granted.',
          hint: 'Redmine sends no CORS headers, so the browser blocks every request to an origin the extension has no permission for.',
        };
        return;
      }

      const check = await testConnection(draft);
      result = check;

      if (check.ok) {
        await prefs.update((current) => ({
          ...current,
          host: check.host,
          useHttpAuth: draft.useHttpAuth,
          httpUser: draft.httpUser,
        }));
        await secrets.set({ apiKey: draft.apiKey, httpPassword: draft.httpPassword });
      }
    } finally {
      testing = false;
    }
  }

  async function loadProjects() {
    loadingProjects = true;
    try {
      const client = new RedmineClient({
        host: prefs.current.host,
        apiKey: secrets.current.apiKey,
        useHttpAuth: prefs.current.useHttpAuth,
        httpUser: prefs.current.httpUser,
        httpPassword: secrets.current.httpPassword,
      });
      const list = await listProjects(client);
      await projects.set(Object.fromEntries(list.map((project) => [String(project.id), project])));
    } catch (error) {
      result = { ok: false, kind: 'unknown', message: String(error) };
    } finally {
      loadingProjects = false;
    }
  }

  function toggleProject(id: number, checked: boolean) {
    updatePrefs({
      projectFilter: {
        mode: prefs.current.projectFilter.mode,
        projectIds: checked
          ? [...prefs.current.projectFilter.projectIds, id]
          : prefs.current.projectFilter.projectIds.filter((value) => value !== id),
      },
    });
  }

  async function clearCaches() {
    await Promise.all([
      issuesItem.removeValue(),
      readStateItem.removeValue(),
      projectsItem.removeValue(),
      enumsItem.removeValue(),
      syncMetaItem.removeValue(),
    ]);
    cleared = 'Cached issues, projects and sync state cleared. The next poll will refetch.';
  }

  const projectList = $derived(
    Object.values(projects.current).sort((a, b) => a.name.localeCompare(b.name)),
  );

  // Single source of truth: the manifest version, which WXT takes from
  // package.json. Hardcoding it here let it drift once already.
  const version = browser.runtime.getManifest().version;
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
  <header>
    <h1 class="text-lg font-semibold">Redmine Helper</h1>
    <p class="text-xs text-text-muted">Version {version}</p>
  </header>

  <Section
    title="Connection"
    description="Where your Redmine lives and how to authenticate with it."
  >
    {#snippet children()}
      <Field label="Redmine host" for="host" hint="The root URL, e.g. https://redmine.example.com">
        {#snippet children()}
          <TextInput id="host" bind:value={draft.host} type="url" placeholder="https://redmine.example.com" />
        {/snippet}
      </Field>

      <Field
        label="API access key"
        for="apiKey"
        hint="Found on your Redmine account page, usually in the right-hand column. Stored locally, never synced."
      >
        {#snippet children()}
          <TextInput id="apiKey" bind:value={draft.apiKey} type="password" placeholder="Your API key" />
        {/snippet}
      </Field>

      <Checkbox
        bind:checked={draft.useHttpAuth}
        label="Redmine is behind HTTP Basic authentication"
      />

      {#if draft.useHttpAuth}
        <div class="grid grid-cols-2 gap-3">
          <Field label="HTTP username" for="httpUser">
            {#snippet children()}
              <TextInput id="httpUser" bind:value={draft.httpUser} />
            {/snippet}
          </Field>
          <Field label="HTTP password" for="httpPassword">
            {#snippet children()}
              <TextInput id="httpPassword" bind:value={draft.httpPassword} type="password" />
            {/snippet}
          </Field>
        </div>
      {/if}

      <div class="flex items-center gap-2">
        <Button variant="primary" loading={testing} onclick={saveAndTest}>
          {#snippet children()}
            <Plug size={13} />
            {testing ? 'Testing…' : 'Save & test connection'}
          {/snippet}
        </Button>
      </div>

      {#if result}
        {#if result.ok}
          <Banner
            tone="success"
            title="Connected"
            message={`Signed in as ${result.user.firstname} ${result.user.lastname} at ${result.host}`}
          />
        {:else}
          <Banner tone="error" title={result.message} hint={result.hint} />
        {/if}
      {/if}
    {/snippet}
  </Section>

  <Section title="Notifications" description="What to tell you about, and how often to check.">
    {#snippet children()}
      <Field label="Show a notification">
        {#snippet children()}
          <div class="flex flex-col gap-1.5">
            <Radio
              name="notifications"
              value="none"
              checked={prefs.current.notifications.mode === 'none'}
              label="Never"
              onchange={() => updatePrefs({ notifications: { mode: 'none' } })}
            />
            <Radio
              name="notifications"
              value="new"
              checked={prefs.current.notifications.mode === 'new'}
              label="For issues new to me"
              onchange={() => updatePrefs({ notifications: { mode: 'new' } })}
            />
            <Radio
              name="notifications"
              value="updated"
              checked={prefs.current.notifications.mode === 'updated'}
              label="For new and updated issues"
              onchange={() => updatePrefs({ notifications: { mode: 'updated' } })}
            />
          </div>
        {/snippet}
      </Field>

      <Field
        label="Check every"
        for="interval"
        hint="Minutes. Chrome will not run alarms more often than once a minute."
      >
        {#snippet children()}
          <div class="w-24">
            <input
              id="interval"
              type="number"
              min={MIN_POLL_INTERVAL_MINUTES}
              max="1440"
              value={prefs.current.pollIntervalMinutes}
              onchange={(event) => setPollInterval(event.currentTarget.value)}
              class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs focus:border-accent"
            />
          </div>
        {/snippet}
      </Field>
    {/snippet}
  </Section>

  <Section title="Projects" description="Limit which projects the issue list covers.">
    {#snippet children()}
      <div class="flex flex-col gap-1.5">
        <Radio
          name="projectFilter"
          value="all"
          checked={prefs.current.projectFilter.mode === 'all'}
          label="All projects I can see"
          onchange={() =>
            updatePrefs({
              projectFilter: { mode: 'all', projectIds: prefs.current.projectFilter.projectIds },
            })}
        />
        <Radio
          name="projectFilter"
          value="selected"
          checked={prefs.current.projectFilter.mode === 'selected'}
          label="Only the projects I pick"
          hint="Applied in the query, so filtered projects cost no bandwidth."
          onchange={() =>
            updatePrefs({
              projectFilter: { mode: 'selected', projectIds: prefs.current.projectFilter.projectIds },
            })}
        />
      </div>

      {#if prefs.current.projectFilter.mode === 'selected'}
        <div class="rounded-md border border-border p-3">
          {#if projectList.length === 0}
            <p class="mb-2 text-xs text-text-muted">No projects loaded yet.</p>
          {:else}
            <div class="mb-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {#each projectList as project (project.id)}
                <Checkbox
                  label={project.name}
                  checked={prefs.current.projectFilter.projectIds.includes(project.id)}
                  onchange={() =>
                    toggleProject(
                      project.id,
                      !prefs.current.projectFilter.projectIds.includes(project.id),
                    )}
                />
              {/each}
            </div>
          {/if}
          <Button loading={loadingProjects} onclick={loadProjects}>
            {#snippet children()}
              <FolderTree size={13} />
              {projectList.length === 0 ? 'Load projects' : 'Refresh projects'}
            {/snippet}
          </Button>
        </div>
      {/if}
    {/snippet}
  </Section>

  <Section title="Display" description="How issues are shown on the full page.">
    {#snippet children()}
      <Field label="Columns in the wide issue list">
        {#snippet children()}
          <div class="flex flex-wrap gap-x-4 gap-y-1.5">
            <Checkbox
              label="Issue id"
              checked={prefs.current.columns.id}
              onchange={() =>
                updatePrefs({ columns: { ...prefs.current.columns, id: !prefs.current.columns.id } })}
            />
            <Checkbox
              label="Project"
              checked={prefs.current.columns.project}
              onchange={() =>
                updatePrefs({
                  columns: { ...prefs.current.columns, project: !prefs.current.columns.project },
                })}
            />
            <Checkbox
              label="Author"
              checked={prefs.current.columns.author}
              onchange={() =>
                updatePrefs({
                  columns: { ...prefs.current.columns, author: !prefs.current.columns.author },
                })}
            />
            <Checkbox
              label="Tracker"
              checked={prefs.current.columns.tracker}
              onchange={() =>
                updatePrefs({
                  columns: { ...prefs.current.columns, tracker: !prefs.current.columns.tracker },
                })}
            />
            <Checkbox
              label="Status"
              checked={prefs.current.columns.status}
              onchange={() =>
                updatePrefs({
                  columns: { ...prefs.current.columns, status: !prefs.current.columns.status },
                })}
            />
          </div>
        {/snippet}
      </Field>

      <Field label="Theme" for="theme">
        {#snippet children()}
          <select
            id="theme"
            class="w-40 rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
            value={prefs.current.theme}
            onchange={(event) =>
              updatePrefs({ theme: event.currentTarget.value as Prefs['theme'] })}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        {/snippet}
      </Field>

      <Field
        label="Round logged time to"
        for="rounding"
        hint="Applied to tracked time before it is logged; you can always edit the value."
      >
        {#snippet children()}
          <select
            id="rounding"
            class="w-40 rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
            value={String(prefs.current.timeRoundingHours)}
            onchange={(event) =>
              updatePrefs({ timeRoundingHours: Number(event.currentTarget.value) })}
          >
            <option value="0">No rounding</option>
            <option value="0.1">6 minutes</option>
            <option value="0.25">15 minutes</option>
            <option value="0.5">30 minutes</option>
            <option value="1">1 hour</option>
          </select>
        {/snippet}
      </Field>
    {/snippet}
  </Section>

  <Section title="Stored data" description="Everything is kept on this machine.">
    {#snippet children()}
      {#if cleared}
        <Banner tone="success" title="Cleared" message={cleared} />
      {/if}
      <div class="flex gap-2">
        <Button variant="danger" onclick={clearCaches}>
          {#snippet children()}
            <Trash2 size={13} />
            Clear cached issues and projects
          {/snippet}
        </Button>
      </div>
      <p class="text-xs text-text-muted">
        Your API key and password stay in local storage and are never synced to your
        Google account. Preferences are synced.
      </p>
    {/snippet}
  </Section>
</div>
