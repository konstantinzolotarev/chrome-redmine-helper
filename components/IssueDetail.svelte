<script lang="ts">
  import { ArrowLeft, ExternalLink, MailOpen, Paperclip, Send } from 'lucide-svelte';

  import { attachFile } from '@/lib/actions/attachments.svelte';
  import { applyIssueChange, loadIssueDetail, postComment } from '@/lib/actions/issues.svelte';
  import { loadMembers } from '@/lib/actions/members.svelte';
  import { buildContext } from '@/lib/format/journal';
  import { issueUrl } from '@/lib/format/markup';
  import type { Issue } from '@/lib/redmine';
  import { enums, markIssueUnread, members, prefs, projects } from '@/lib/store/app.svelte';

  import CopyLinkButton from './CopyLinkButton.svelte';
  import InlineNumber from './InlineNumber.svelte';
  import InlineSelect from './InlineSelect.svelte';
  import JournalEntry from './JournalEntry.svelte';
  import Markup from './Markup.svelte';
  import RelativeTime from './RelativeTime.svelte';
  import Button from './ui/Button.svelte';

  interface Props {
    issue: Issue;
    onback: () => void;
  }

  let { issue, onback }: Props = $props();

  let comment = $state('');
  let sending = $state(false);
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  const host = $derived(prefs.current.host);
  const detailLoaded = $derived(issue.journals !== undefined);

  // Fetch journals/attachments the first time this issue is opened.
  $effect(() => {
    if (!detailLoaded) void loadIssueDetail(issue.id);
  });

  // Assignable users, for the assignee picker.
  $effect(() => {
    void loadMembers(issue.project.id);
  });

  const assignees = $derived(members.current[String(issue.project.id)] ?? []);

  const journalContext = $derived(
    buildContext({
      statuses: enums.current.statuses,
      trackers: enums.current.trackers,
      priorities: enums.current.priorities,
      projects: Object.values(projects.current).map((project) => ({
        id: project.id,
        name: project.name,
      })),
    }),
  );

  const journals = $derived((issue.journals ?? []).slice().reverse());

  async function send() {
    const text = comment.trim();
    if (!text) return;
    sending = true;
    try {
      if (await postComment(issue.id, text)) comment = '';
    } finally {
      sending = false;
    }
  }
</script>

<div class="flex h-full flex-col">
  <header class="flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
    <button
      class="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text"
      title="Back to the list"
      aria-label="Back to the list"
      onclick={onback}><ArrowLeft size={15} /></button
    >
    <span class="flex-1 truncate text-xs font-medium">#{issue.id}</span>
    <button
      class="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text"
      title="Mark unread"
      aria-label="Mark unread"
      onclick={() => markIssueUnread(issue.id)}><MailOpen size={14} /></button
    >
    <CopyLinkButton url={issueUrl(host, issue.id)} label="issue {issue.id}" size={14} />
    <a
      class="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text"
      href={issueUrl(host, issue.id)}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Redmine"
      aria-label="Open in Redmine"><ExternalLink size={14} /></a
    >
  </header>

  <div class="flex-1 overflow-y-auto px-3 py-2">
    <h2 class="text-sm font-semibold">{issue.subject}</h2>
    <p class="mt-0.5 text-[11px] text-text-muted">
      {issue.project.name} · opened by {issue.author?.name ?? 'someone'}
      <RelativeTime value={issue.created_on} prefix=" " />
    </p>

    <dl class="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
      <dt class="text-text-muted">Status</dt>
      <dd>
        <InlineSelect
          label="status"
          value={issue.status?.id}
          display={issue.status?.name ?? '—'}
          options={enums.current.statuses}
          onsave={(next) =>
            next === null
              ? false
              : applyIssueChange(
                  issue.id,
                  { status_id: next },
                  { status: { id: next, name: enums.current.statuses.find((s) => s.id === next)?.name ?? '' } },
                )}
        />
      </dd>

      <dt class="text-text-muted">Tracker</dt>
      <dd>
        <InlineSelect
          label="tracker"
          value={issue.tracker?.id}
          display={issue.tracker?.name ?? '—'}
          options={enums.current.trackers}
          onsave={(next) =>
            next === null
              ? false
              : applyIssueChange(
                  issue.id,
                  { tracker_id: next },
                  { tracker: { id: next, name: enums.current.trackers.find((t) => t.id === next)?.name ?? '' } },
                )}
        />
      </dd>

      <dt class="text-text-muted">Priority</dt>
      <dd>
        <InlineSelect
          label="priority"
          value={issue.priority?.id}
          display={issue.priority?.name ?? '—'}
          options={enums.current.priorities}
          onsave={(next) =>
            next === null
              ? false
              : applyIssueChange(
                  issue.id,
                  { priority_id: next },
                  { priority: { id: next, name: enums.current.priorities.find((p) => p.id === next)?.name ?? '' } },
                )}
        />
      </dd>

      <dt class="text-text-muted">Assignee</dt>
      <dd class="truncate">
        {#if assignees.length > 0}
          <InlineSelect
            label="assignee"
            value={issue.assigned_to?.id}
            display={issue.assigned_to?.name ?? '—'}
            options={assignees}
            allowEmpty
            emptyLabel="Nobody"
            onsave={(next) =>
              applyIssueChange(
                issue.id,
                { assigned_to_id: next },
                {
                  assigned_to:
                    next === null
                      ? undefined
                      : { id: next, name: assignees.find((u) => u.id === next)?.name ?? '' },
                },
              )}
          />
        {:else}
          {issue.assigned_to?.name ?? '—'}
        {/if}
      </dd>

      <dt class="text-text-muted">% Done</dt>
      <dd>
        <InlineNumber
          label="percent done"
          value={issue.done_ratio}
          display={`${issue.done_ratio ?? 0}%`}
          min={0}
          max={100}
          step={10}
          onsave={(next) =>
            applyIssueChange(issue.id, { done_ratio: next ?? 0 }, { done_ratio: next ?? 0 })}
        />
      </dd>

      <dt class="text-text-muted">Estimated</dt>
      <dd>
        <InlineNumber
          label="estimated hours"
          value={issue.estimated_hours ?? null}
          display={issue.estimated_hours != null ? `${issue.estimated_hours}h` : '—'}
          min={0}
          step={0.5}
          onsave={(next) =>
            applyIssueChange(issue.id, { estimated_hours: next }, { estimated_hours: next })}
        />
      </dd>
    </dl>

    {#if issue.description}
      <div class="mt-3 rounded border border-border p-2 text-xs">
        <Markup text={issue.description} {host} />
      </div>
    {/if}

    {#if issue.attachments && issue.attachments.length > 0}
      <ul class="mt-3 flex flex-col gap-1 text-xs">
        {#each issue.attachments as file (file.id)}
          <li class="flex items-center gap-1.5">
            <Paperclip size={12} class="shrink-0 text-text-muted" />
            <a
              href={file.content_url}
              target="_blank"
              rel="noopener noreferrer"
              class="truncate text-accent hover:underline">{file.filename}</a
            >
          </li>
        {/each}
      </ul>
    {/if}

    <section class="mt-4">
      <h3 class="text-xs font-semibold text-text-muted">History</h3>
      {#if !detailLoaded}
        <p class="mt-1 text-xs text-text-muted">Loading…</p>
      {:else if journals.length === 0}
        <p class="mt-1 text-xs text-text-muted">Nothing has happened yet.</p>
      {:else}
        <div class="mt-1">
          {#each journals as journal (journal.id)}
            <JournalEntry
              {journal}
              context={journalContext}
              {host}
              attachments={issue.attachments ?? []}
            />
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <footer class="border-t border-border bg-surface p-2">
    <textarea
      bind:value={comment}
      rows="2"
      placeholder="Add a comment…"
      aria-label="Add a comment"
      class="w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-xs focus:border-accent"
    ></textarea>
    <div class="mt-1.5 flex items-center justify-between">
      <input
        bind:this={fileInput}
        type="file"
        class="hidden"
        aria-label="Attach a file"
        onchange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;
          uploading = true;
          try {
            await attachFile(issue.id, file);
          } finally {
            uploading = false;
            if (fileInput) fileInput.value = '';
          }
        }}
      />
      <Button loading={uploading} onclick={() => fileInput?.click()}>
        {#snippet children()}
          <Paperclip size={12} />
          Attach
        {/snippet}
      </Button>
      <Button variant="primary" loading={sending} disabled={comment.trim() === ''} onclick={send}>
        {#snippet children()}
          <Send size={12} />
          Comment
        {/snippet}
      </Button>
    </div>
  </footer>
</div>
