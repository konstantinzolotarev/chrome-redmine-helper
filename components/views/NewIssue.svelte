<script lang="ts">
  import { Plus } from 'lucide-svelte';

  import { createNewIssue } from '@/lib/actions/issues.svelte';
  import { loadMembers } from '@/lib/actions/members.svelte';
  import { issueUrl } from '@/lib/format/markup';
  import { enums, members, prefs, projects } from '@/lib/store/app.svelte';
  import { contextSelectionItem } from '@/lib/store/items';

  import Banner from '../ui/Banner.svelte';
  import Button from '../ui/Button.svelte';
  import Field from '../ui/Field.svelte';

  let projectId = $state('');
  let trackerId = $state('');
  let priorityId = $state('');
  let assigneeId = $state('');
  let subject = $state('');
  let description = $state('');
  let saving = $state(false);
  let created = $state<{ id: number; subject: string } | null>(null);

  const projectList = $derived(
    Object.values(projects.current).sort((a, b) => a.name.localeCompare(b.name)),
  );
  const assignees = $derived(projectId ? (members.current[projectId] ?? []) : []);

  /**
   * Pull in text selected via the context menu.
   *
   * Read from `storage.session`: v1 kept it in a background-page global, which
   * MV3 discards whenever the worker is torn down (D8).
   */
  $effect(() => {
    void (async () => {
      const selection = await contextSelectionItem.getValue();
      if (!selection) return;

      // First line becomes the subject, the rest the description.
      const [firstLine, ...rest] = selection.split('\n');
      if (!subject) subject = (firstLine ?? '').slice(0, 255);
      if (!description) description = rest.join('\n').trim() || selection;

      await contextSelectionItem.removeValue();
    })();
  });

  $effect(() => {
    if (projectId) void loadMembers(Number(projectId));
  });

  // Default the selects once the enumerations are cached.
  $effect(() => {
    if (!trackerId && enums.current.trackers.length > 0) {
      trackerId = String(enums.current.trackers[0]!.id);
    }
    if (!priorityId && enums.current.priorities.length > 0) {
      const fallback = enums.current.priorities.find((p) => p.is_default) ?? enums.current.priorities[0]!;
      priorityId = String(fallback.id);
    }
  });

  const valid = $derived(projectId !== '' && subject.trim() !== '');

  async function submit() {
    if (!valid) return;
    saving = true;
    try {
      const issue = await createNewIssue({
        project_id: Number(projectId),
        tracker_id: trackerId ? Number(trackerId) : undefined,
        priority_id: priorityId ? Number(priorityId) : undefined,
        assigned_to_id: assigneeId ? Number(assigneeId) : undefined,
        subject: subject.trim(),
        description,
      });

      if (issue) {
        created = { id: issue.id, subject: issue.subject };
        subject = '';
        description = '';
        assigneeId = '';
      }
    } finally {
      saving = false;
    }
  }
</script>

<div class="flex max-w-2xl flex-col gap-3">
  {#if created}
    <Banner tone="success" title={`Created #${created.id}`} message={created.subject} />
    <p class="text-xs">
      <a
        href={issueUrl(prefs.current.host, created.id)}
        target="_blank"
        rel="noopener noreferrer"
        class="text-accent hover:underline">Open it in Redmine</a
      >
    </p>
  {/if}

  <div class="grid gap-3 sm:grid-cols-2">
    <Field label="Project" for="ni-project">
      {#snippet children()}
        <select
          id="ni-project"
          bind:value={projectId}
          class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
        >
          <option value="">Choose a project…</option>
          {#each projectList as project (project.id)}
            <option value={String(project.id)}>{project.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>

    <Field label="Tracker" for="ni-tracker">
      {#snippet children()}
        <select
          id="ni-tracker"
          bind:value={trackerId}
          class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
        >
          {#each enums.current.trackers as tracker (tracker.id)}
            <option value={String(tracker.id)}>{tracker.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>

    <Field label="Priority" for="ni-priority">
      {#snippet children()}
        <select
          id="ni-priority"
          bind:value={priorityId}
          class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
        >
          {#each enums.current.priorities as priority (priority.id)}
            <option value={String(priority.id)}>{priority.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>

    <Field
      label="Assignee"
      for="ni-assignee"
      hint={projectId && assignees.length === 0 ? 'No assignable members visible for this project.' : undefined}
    >
      {#snippet children()}
        <select
          id="ni-assignee"
          bind:value={assigneeId}
          disabled={assignees.length === 0}
          class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs disabled:opacity-50"
        >
          <option value="">Nobody</option>
          {#each assignees as user (user.id)}
            <option value={String(user.id)}>{user.name}</option>
          {/each}
        </select>
      {/snippet}
    </Field>
  </div>

  <Field label="Subject" for="ni-subject">
    {#snippet children()}
      <input
        id="ni-subject"
        bind:value={subject}
        maxlength="255"
        class="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs focus:border-accent"
      />
    {/snippet}
  </Field>

  <Field label="Description" for="ni-description">
    {#snippet children()}
      <textarea
        id="ni-description"
        bind:value={description}
        rows="8"
        class="w-full resize-y rounded-md border border-border bg-bg px-2 py-1.5 text-xs focus:border-accent"
      ></textarea>
    {/snippet}
  </Field>

  <div>
    <Button variant="primary" loading={saving} disabled={!valid} onclick={submit}>
      {#snippet children()}
        <Plus size={13} />
        Create issue
      {/snippet}
    </Button>
  </div>
</div>
