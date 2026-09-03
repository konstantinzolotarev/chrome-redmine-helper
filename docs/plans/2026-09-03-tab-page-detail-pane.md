# Tab page: in-app issue detail pane

- **Date:** 2026-09-03
- **Branch:** `rewrite/svelte-mv3`
- **Origin:** brainstorm session, 2026-09-03
- **Follows:** [2026-09-01-svelte-mv3-rewrite.md](./2026-09-01-svelte-mv3-rewrite.md)

---

## 1. Context

### The problem

The full tab page and the side panel diverged. In the side panel, clicking an
issue opens it *inside* the extension — `IssueCard` sets `selectedId`, the list
swaps out for `IssueDetail`, and "open in Redmine" is a separate `ExternalLink`
icon in that detail header. In the tab page, `IssueTable` wraps the subject in
`<a href={issueUrl(host, issue.id)} target="_blank">`, so a click leaves the
extension entirely. The tab page has no detail view, and no way to start a timer.

So the wide surface — the one that exists *because* it has room — is the weaker
of the two.

### What exists today

| File | Role | Change |
|---|---|---|
| `entrypoints/app/App.svelte` | hash-routed tab page, nav + `<main>` | selection, split layout, `TimerHost` |
| `components/views/IssueTable.svelte` | the table | subject link, actions column, selection tint |
| `components/IssueDetail.svelte` | detail; back / mark-unread / open-in-Redmine | **none** — reused verbatim |
| `components/IssueCard.svelte` | side panel row; Play/Pause | none; its icons are the model for the table's |
| `entrypoints/sidepanel/App.svelte` | side panel | timer plumbing moves out to `TimerHost` |
| `lib/router.ts` | `parseHash`, `idSegment`, `routeName` | none — `idSegment` is already the right shape |

`lib/router.ts` ships `idSegment(route, at = 1)` — *"The numeric id in
`/issues/42`"* — and **nothing calls it**. The route shape for this was
anticipated during the rewrite and never wired up. That is the address we use.

---

## 2. Decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| 1 | **Master–detail split**: table left, detail in a right pane | Uses the width the tab page exists for; the list stays visible so you can click through issues. `IssueDetail` is built for ~360px, so the pane needs no restyling | Replace-the-view (wastes the width); a `wide` variant on `IssueDetail` (two layouts to maintain) |
| 2 | **Row actions: Play/Pause + `ExternalLink`** | Full parity with `IssueCard`. The table has no way to start a timer today, which is the one real capability gap between the surfaces | External link alone; adding a third mark-read toggle (too dense at table height) |
| 3 | **Selection lives in the hash**: `#/issues/42` | Back/Forward step through issues, reload keeps the place, the issue becomes deep-linkable, and `idSegment` already exists for it. Subjects stay anchors, so ⌘-click still works | Local `$state` — right in a 360px panel with no address bar, wrong in a browser tab |
| 4 | **Extract `TimerHost`** rather than duplicate | The pending-session state, `LogTimeDialog` and the tracking banner would otherwise exist in both entrypoints; a fix to the stop-timer flow would have to land twice | Duplicating ~30 lines in `app/App.svelte` |

---

## 3. Design

### Routing

```ts
const selectedId = $derived(idSegment(route.current));           // #/issues/42 → 42
const selected   = $derived(selectedId === null ? null : issues.current[String(selectedId)]);
```

`routeName()` reads `segments[0]`, so `/issues/42` still reports `issues` and the
nav tab stays highlighted unchanged. Closing the pane is `navigate('/issues')`,
passed as `IssueDetail`'s `onback`. An `$effect` calls `markIssueRead` when the
route lands on an id, mirroring the side panel's `open()`.

**Uncached id.** A deep link to an issue that has been pruned (90 days / 500 cap)
or reassigned away renders a short "not in your list" pane with a link to
Redmine, rather than fetching. The cache *is* the list this page shows.

### Layout

```
grid-cols-1                →  #/issues      table full width
lg:grid-cols-[1fr_380px]   →  #/issues/42   table + pane
```

Below `lg` the pane replaces the table instead of squeezing it — the side
panel's behaviour, correct at that width. The pane is sticky and full-height so
history scrolls inside it rather than scrolling the page.

### Table

Subject becomes `<a href="#/issues/{id}">` — still an anchor, so ⌘-click,
middle-click and keyboard nav all keep working. A trailing actions column carries
Play/Pause and `ExternalLink`, lifted from `IssueCard` so both surfaces share
labels and colours (tracking = `text-danger`). Selected row gets `bg-surface-2`.

Actions are `opacity-0 group-hover:opacity-100 focus-within:opacity-100`, and
always visible while the row is selected or its timer runs — `focus-within`
covers keyboard, and nothing vanishes mid-task.

New props: `selectedId`, `trackingId`, `ontoggletimer`.

### TimerHost

Owns `pendingSession`, the `{#key session.id}` `LogTimeDialog`, the tracking
banner and its 1-second clock. Exports `toggle(issueId, subject)`, reached from
row buttons via `bind:this`. Takes `onopen` so the banner can navigate — the
side panel sets `selectedId`, the tab page calls `navigate`.

---

## 4. Stages

### Stage 1 — `TimerHost`

- [x] `components/TimerHost.svelte`: `pendingSession`, `now` clock, banner, dialog, exported `toggle()`
- [x] `onopen(issueId)` prop for the banner, and a `banner` boolean — the tab page mounts it under the header, so one bar style serves both surfaces and no padding variant is needed
- [x] Rewire `entrypoints/sidepanel/App.svelte` onto it; delete the inlined copy
- [x] Side panel tests still pass unchanged

### Stage 2 — `IssueTable`

- [x] Subject → `<a href="#/issues/{id}">`; drop `target="_blank"`
- [x] Actions column: Play/Pause + `ExternalLink`, hover/focus reveal
- [x] `selectedId` tint, `trackingId` state, `ontoggletimer` prop
- [x] Keep the `columns` prefs behaviour untouched

### Stage 3 — tab page

- [x] `selectedId` / `selected` derived from the route; `markIssueRead` effect
- [x] Split grid in `<main>`, `lg` breakpoint, sticky pane
- [x] Render `IssueDetail` with `onback={() => navigate('/issues')}`
- [x] Uncached-id fallback pane
- [x] Mount `TimerHost`; wire row buttons through it

### Stage 4 — tests

- [x] Rewrite `App.test.ts:193` "links issue subjects out to Redmine" — **fails by design**: the subject now points at `#/issues/1`, and the absolute URL moves to the new icon
- [x] Clicking a subject opens the pane and marks the issue read
- [x] Back closes the pane and returns to `#/issues`
- [x] A deep-linked `#/issues/42` renders the pane on load
- [x] An uncached `#/issues/999` renders the fallback
- [x] Start/stop a timer from a row
- [x] `npm run check` clean, full suite green, both builds

---

## 5. Out of scope

- Column config for the actions column — they are actions, not data
- Fetching uncached issues on deep link (see Design → Uncached id)
- Any change to `IssueDetail` itself
