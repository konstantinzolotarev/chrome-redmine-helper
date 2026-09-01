# Redmine Helper 2.0 — Svelte + Manifest V3 rewrite

- **Date:** 2026-09-01
- **Branch:** `rewrite/svelte-mv3` (off `master` @ 9881f4e)
- **Version:** 1.6.6 → 2.0.0
- **Origin:** brainstorm session, 2026-09-01

---

## 1. Context

### What exists today (v1.6.6, ~4,000 LOC)

AngularJS 1.0 + Bootstrap 2 + jQuery, Manifest V2, non-persistent background page.
The toolbar icon opens `html/main.html` in a full tab; there is no popup.

| Area | Files | Notes |
|---|---|---|
| Background/orchestration | `js/background.js`, `js/bg_base.js` | alarms, badge, context menu, error fan-out |
| Settings | `js/config.js` | `Config` class over `chrome.storage.sync.profile` |
| Redmine API | `js/lib/api.js` | Closure-minified, XHR-based, callback style |
| Domain modules | `js/redmine/{issues,projects,users,timeline,news}.js` | mutable singletons on `com.rdHelper.*` |
| UI | `js/main.js`, `js/mainControllers.js`, `html/partials/*.html` | Angular routes, controllers, directives |

### Feature inventory (all of this must survive)

1. **Issue list** — polls `assigned_to_id` + `watcher_id` every 5 min; unread tracking + badge;
   mark read / unread / all-read; subject search; configurable columns
   (id, author, project, tracker, status); client-side paging.
2. **Issue details** — inline edit of status, tracker, % done, estimated hours; journal history
   rendered as human-readable diffs; add comment + "reply"; file upload via `/uploads.json`;
   open in Redmine web UI.
3. **Time tracking** — local-only start/stop timers in `chrome.storage.local`; list view;
   stop / remove / clear. **Never sent to Redmine.**
4. **New issue** — project, tracker, assignee, subject, description; also reachable from the
   context menu "Create new Redmine issue" acting on the page selection.
5. **Projects** — project list; detail with that project's issues and memberships.
6. **News** — `/news.json` feed.
7. **Options** — host, API key, HTTP Basic auth, ChiliProject toggle, notification mode
   (none / new / updated), project filter (all / selected), column prefs, hide-hints,
   clear-storage. Stored in `chrome.storage.sync`.

### What is outright dead under MV3

- `chrome.extension.getBackgroundPage()` — **the entire UI is built on this.** Every controller
  does `BG.com.rdHelper.Issues.markAsRead(...)`, reaching into the background page's live object
  graph. There is no such graph in MV3; the worker is torn down after ~30s idle.
- `webkitNotifications` — removed from Chrome.
- `localStorage` in the worker (`onInstalled` calls `localStorage.clear()`).
- `browser_action` → `action`; `chrome.extension.sendMessage` → `chrome.runtime.sendMessage`.
- `chrome.tabs.getAllInWindow` → `chrome.tabs.query`.
- `XMLHttpRequest` in a service worker → `fetch`.
- AngularJS 1.0, Bootstrap 2, jQuery — all EOL.

### Defects to fix while rewriting

| # | Defect | Location |
|---|---|---|
| D1 | **XSS.** Journal renderer builds HTML strings from API values and injects via `element.html()`. `old_value`/`new_value`/`subject` are unescaped and execute in extension context. | `js/main.js` `issueHistory` directive |
| D2 | Unread counter drifts — `unread` is incremented/decremented by hand in `markAsRead`/`markAsUnRead` alongside a separate recount in `updateUnread`. | `js/redmine/issues.js` |
| D3 | Read state is a `read` boolean mutated onto the cached issue object, so a refetch clobbers it. | `js/redmine/issues.js` |
| D4 | `issues` map grows forever — no eviction anywhere. | `js/redmine/issues.js` |
| D5 | `getPriorities()` is dead code (`return;` + "Now not working in Redmine"). The endpoint works. | `js/redmine/issues.js` |
| D6 | `Timeline.isLoaded()` references undefined `thiss`. | `js/redmine/timeline.js` |
| D7 | Full re-page of every assigned issue every 5 minutes; project filter applied client-side after fetching. | `js/redmine/issues.js` |
| D8 | Context-menu selection stored in a background global (`var selectedText`) — lost on worker restart. | `js/background.js` |
| D9 | Journal `switch` covers 7 properties, falls through to "Sorry this is under development" for priority, target version, dates, parent, relations, custom fields. | `js/main.js` |

---

## 2. Decisions from the brainstorm

| Decision | Choice | Rationale |
|---|---|---|
| UI surface | **Side panel (primary) + full tab page** | Side panel is the daily driver — list, detail, timer — docked next to whatever you're working on. Projects / news / new issue / options get the full tab. One Svelte app, two mount points. |
| Auth | API key (`X-Redmine-API-Key`) **+ HTTP Basic** **+ connection test** | Basic auth covers reverse-proxied Redmine and composes with the API key header. |
| Dropped | **ChiliProject**, multi-profile support | ChiliProject archived since 2015. Multi-profile is scope with no stated need. |
| Time tracking | **Log to Redmine on stop**, with offline queue | Timer stays local; stopping opens a form that POSTs a real `/time_entries.json` entry. Unsent sessions queue locally, retryable. |
| State model | **Storage-as-truth + shared client** | `chrome.storage.local` is the single source of truth. Worker polls; UI fetches for user actions; both import `lib/redmine`. Svelte stores bridge `storage.onChanged`, so all surfaces stay in sync with no message plumbing. |
| Toolchain | **WXT + Svelte 5 + TypeScript** | File-based entrypoints, MV3 manifest generation, real HMR in extension contexts, Firefox build from the same source. |
| Styling | **Tailwind 4 + native primitives + lucide-svelte** | `<dialog>` for modals, `<select>` for inline edits, `:popover` for menus. Three UI deps total. |
| Screen scope | **Full parity** — news, projects browser, configurable columns, watched issues all kept | User's call: replicate everything. |
| Dev Redmine | **New `dev/docker-compose.yml` in repo** | Reproducible, seedable, usable in CI. |

### Stack versions (verified on npm / Docker Hub, 2026-09-01)

```
svelte                       5.57.0     (runes)
wxt                          0.21.4     (0.x — pin exactly, config surface can shift)
vite                         8.2.2
@sveltejs/vite-plugin-svelte 7.3.0
lucide-svelte                1.0.1
tailwindcss                  4.3.3      (CSS-first config, no tailwind.config.js)
vitest                       4.1.11
redmine (docker)             7.0.1      (6.1.4 / 6.0.11 also maintained)
```

Target Redmine 7.0, stay compatible back to 5.x — every endpoint used is stable across all three.

---

## 3. Architecture

```
  ┌─ service worker ─┐        ┌─ side panel ─┐   ┌─ tab page ─┐
  │ alarm: delta poll│        │ Svelte 5 app │   │ Svelte app │
  │ badge, notifs,   │        │ user actions │   │            │
  │ context menu     │        └──────┬───────┘   └─────┬──────┘
  └────────┬─────────┘               │                 │
           │        both contexts import              │
           └──────────► lib/redmine ◄─────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │ chrome.storage.local│  ◄── source of truth
                   │  (+ .sync for prefs)│
                   └──────────┬──────────┘
                              │ onChanged
                   ┌──────────▼──────────┐
                   │ Svelte $state stores│
                   └─────────────────────┘
```

### Layout

```
wxt.config.ts                  manifest v3, permissions, side panel
package.json
tsconfig.json
entrypoints/
  background.ts                alarms, badge, notifications, context menu, migration
  sidepanel/index.html + App.svelte
  app/index.html      + App.svelte      full tab: projects, news, new issue, time log
  options/index.html  + App.svelte
lib/
  redmine/
    client.ts                  fetch wrapper: auth, errors, timeout, paging generator
    issues.ts  projects.ts  users.ts  news.ts  time-entries.ts  enums.ts  uploads.ts
    types.ts                   hand-written types for API shapes
    errors.ts                  typed error union
  store/
    storage.ts                 typed chrome.storage wrapper
    reactive.svelte.ts         storage.onChanged → $state bridge  ← replaces getBackgroundPage()
    issues.svelte.ts  settings.svelte.ts  timers.svelte.ts  readstate.svelte.ts
  sync/
    poller.ts                  delta poll + unread diffing + retention
    notify.ts                  chrome.notifications
  migrate/
    v1.ts                      1.6.6 storage → 2.0.0 shape
components/                    IssueCard, IssueList, IssueDetail, JournalEntry,
                               InlineEdit, LogTimeDialog, TimerButton, Markup, …
dev/
  docker-compose.yml           redmine:7.0 + postgres:17
  seed.rb                      rails runner seed
```

Deleted: `js/`, `html/`, `css/`, `build/`, `build.xml`, `build.sh`, `git_push.sh`.
Kept: `icon/`, `rest/` (screenshots + changelog).

### Key design points

- **`reactive.svelte.ts`** is the direct replacement for `getBackgroundPage()`. Generic over a
  storage key: seeds a `$state` rune from `chrome.storage.local`, subscribes to
  `storage.onChanged`, writes back on mutation. Mark an issue read in the side panel and the open
  tab updates on its own.
- **CORS.** Redmine sends no CORS headers. Extension pages and the worker only bypass CORS on
  origins they hold host permission for. Manifest declares
  `optional_host_permissions: ["*://*/*"]`; Options calls `chrome.permissions.request()` for the
  specific origin when the host is saved. **No permission → no requests.** This is the primary
  failure mode and what the connection test exists to surface.
- **Secrets.** API key and HTTP Basic password go in `chrome.storage.local` (not `sync`, which
  round-trips through Google). Non-secret prefs (columns, notification mode, project filter)
  stay in `sync`.
- **Read state** lives in its own `Record<issueId, readAt>` map. Unread is derived —
  `issue.updated_on > readAt` — never a hand-maintained counter. Fixes D2 + D3.
- **Delta polling.** `updated_on=>=<lastPolledAt>` with `assigned_to_id=me`, then `watcher_id=me`.
  Two requests per poll instead of a recursive re-page. Project filter moves into the query as
  pipe-separated `project_id=3|7|12`. Fixes D7.
- **Paging.** One `async function*` generator reused by every list endpoint. `limit` is 100
  (Redmine's max), not the 25/50 in use today.
- **API simplifications.** `assigned_to_id=me` removes the "resolve currentUserId first" bootstrap.
  Trackers come from global `/trackers.json` rather than per-project `include=trackers`.
- **No raw HTML path anywhere.** Journals, descriptions and comments render as Svelte markup
  (auto-escaped) with preserved line breaks, linkified URLs and `#1234` references. Fixes D1.
- **Notifications** click-through routes to the **tab page**, not the side panel —
  `chrome.sidePanel.open()` requires a user gesture and it is unverified whether a notification
  click qualifies. See open question O1.

---

## 4. Implementation stages

### Stage 0 — Scaffold
- [x] `npm init` + install pinned deps (svelte 5.57, wxt 0.21.4, tailwindcss 4.3.3, lucide-svelte 1.0.1, typescript, vitest 4.1.11)
- [x] `wxt.config.ts`: MV3, name/version 2.0.0, `action`, `side_panel`, permissions
      (`storage`, `alarms`, `notifications`, `contextMenus`, `sidePanel`, `tabs`),
      `optional_host_permissions: ["*://*/*"]`, icons from existing `icon/`
- [x] `tsconfig.json`, Tailwind 4 CSS-first theme (light + dark tokens)
- [x] Empty entrypoints that build and load unpacked in Chrome
- [x] Delete `js/`, `html/`, `css/`, `build/`, `build.xml`, `build.sh`, `git_push.sh`
- [x] `.gitignore`: `node_modules`, `.wxt`, `.output`, `dev/.api-key`

### Stage 1 — Dev Redmine
- [x] `dev/docker-compose.yml` — `redmine:7.0` on :3000 + `postgres:17`
- [x] `dev/seed.rb` — enable `rest_api_enabled`, mint admin API key → `dev/.api-key`,
      create project `sandbox`, trackers, statuses, priorities, time-entry activities,
      ~30 issues with journals and attachments, a few time entries, a second project for
      filter testing
- [x] `dev/README.md` — up / seed / reset commands

### Stage 2 — Redmine client (`lib/redmine/`)
- [x] `types.ts` — Issue, Project, User, Journal, Attachment, TimeEntry, enumerations, paged envelope
- [x] `errors.ts` — typed union: `PermissionDenied`, `Unauthorized` (401), `ApiDisabled` (403),
      `NotFound` (404), `Validation` (422, carries `errors[]`), `RateLimited` (429),
      `ServerError` (5xx), `NetworkError`, `Timeout`
- [x] `client.ts` — host normalization, `X-Redmine-API-Key` + optional `Authorization: Basic`,
      JSON handling, `AbortSignal` timeout, error mapping, `paginate()` generator (limit 100)
- [x] `issues.ts` — list (filters incl. `updated_on=>=`, `assigned_to_id=me`, `watcher_id=me`,
      `project_id=a|b|c`), get (`include=journals,attachments,relations`), create, update
- [x] `enums.ts` — `/issue_statuses.json`, `/trackers.json`,
      `/enumerations/issue_priorities.json` (fixes D5),
      `/enumerations/time_entry_activities.json`
- [x] `projects.ts` — list, get, memberships; `users.ts` — `current`, list
- [x] `news.ts`, `time-entries.ts` (create/list/update/delete), `uploads.ts` (`/uploads.json`)
- [x] Vitest suite with mocked `fetch`: auth headers, error mapping, paging, filter encoding

### Stage 3 — Storage + reactive stores
- [x] `store/storage.ts` — typed get/set/remove over local + sync, schema-versioned
- [x] `store/reactive.svelte.ts` — the `getBackgroundPage()` replacement
- [x] `settings.svelte.ts` — secrets in local, prefs in sync
- [x] `issues.svelte.ts`, `readstate.svelte.ts` (derived unread — D2/D3), `timers.svelte.ts`
- [x] `migrate/v1.ts` — `sync.profile` → new settings (drop `chiliProject`);
      `local.timelines` → unsent time sessions; discard cached `issues`/`projects`/`users`
- [x] Vitest over unread derivation, retention, and the v1 migration

### Stage 4 — Service worker
- [x] `sync/poller.ts` — cold-start backfill (bounded), then delta polls; retention cap on the
      issue cache (D4); backoff on failure
- [x] Periodic `chrome.alarms` (configurable interval, default 5 min)
- [x] `chrome.action` badge derived from unread; badge colour
- [x] `sync/notify.ts` — `chrome.notifications`, honours none/new/updated, collapses batches
- [x] Context menu → selection into `chrome.storage.session` (D8) → open tab at `#/new-issue`
- [x] `onInstalled`: run migration on `update`, open Options on `install`
- [x] Toolbar click opens the side panel

### Stage 5 — Options page
- [x] Connection: host, API key, HTTP Basic toggle + credentials
- [x] Host permission request on save via `chrome.permissions.request()`
- [x] **Test connection** → `/users/current.json`, mapping each failure to a real message
      (permission / 401 / 403 API disabled / 404 not Redmine / network)
- [x] Notifications: none / new / updated; poll interval
- [x] Project filter: all vs selected list
- [x] Column prefs (tab-page list); time rounding increment; clear stored data

### Stage 6 — Side panel
- [x] Two-level stack: list → detail → back (no router)
- [x] `IssueCard` — unread dot, id, subject, project, status, watched marker, timer button
- [x] Subject search; watched issues marked with an eye icon (a per-issue marker rather than
      separate groups — the panel is too narrow for section headers to earn their space)
- [x] Mark read on open, mark unread, mark all read
- [x] `IssueDetail` — fields, journals, comment box, attachments
- [x] `InlineEdit` — status, tracker, priority, assignee, % done, estimated hours;
      optimistic update with rollback
- [x] `JournalEntry` — escaped Svelte markup covering priority, target version, dates, parent,
      relations, custom fields (`property: "cf"`) (D1 + D9)
- [x] `Markup` — text with preserved line breaks, linkified URLs and `#1234` refs
- [x] File upload → `/uploads.json` → attach on update

### Stage 7 — Time tracking
- [x] Global single active timer `{issueId, startedAt}`; starting one stops the other
- [x] Elapsed computed on read; UI ticks only while visible
- [x] `LogTimeDialog` — hours (rounded, configurable increment, default 0.25), `spent_on`,
      activity dropdown, comment → `POST /time_entries.json`
- [x] Unsent queue on failure/offline, with discard from the dialog (retry/edit lives on the
      Time log screen — Stage 8)
- [x] Time log screen on the tab page

### Stage 8 — Tab page
- [x] Hash router (~30 lines) preserving deep links incl. `#/new-issue`
- [x] New issue: project, tracker, assignee, priority, subject, description;
      prefilled from context-menu selection
- [x] Projects: list + detail (issues, memberships)
- [x] News feed
- [x] Wide issue list with configurable columns
- [x] Dark mode toggle

### Stage 9 — Polish and release
- [x] Empty / loading / error states on every screen
- [x] Keyboard focus and ARIA — a global `:focus-visible` ring (components had suppressed the
      outline and signalled focus only with a border tint, which is not navigable), `aria-live`
      on the issue count, labels on every icon button, and a `prefers-reduced-motion` guard
- [x] Firefox build check — builds clean, with a gecko id and
      `data_collection_permissions: none`. Note WXT targets **MV2** for Firefox by default,
      since Firefox has no `sidePanel` API (it uses `sidebar_action`). Chrome is MV3.
- [x] Update `rest/Changelog` and `rest/DESC` — **screenshots still to be retaken** (they show
      the 2012 UI and need a running browser)
- [x] Root `README.md` — install, dev, docker, architecture
- [ ] Manual QA against seeded Docker Redmine + an upgrade test from real 1.6.6 storage

---

---

## 6. Verified against a live Redmine 7.0 (2026-09-01)

Stage 1's Docker instance was used to probe the API before building on it. Four
assumptions in the original design turned out to be wrong; the client encodes the
corrected behaviour and `lib/redmine/client.test.ts` guards each one.

| # | Assumption | Reality |
|---|---|---|
| F1 | `project_id=1\|2\|3` filters by several projects | **404.** That parameter is read as a single project id or identifier. Multi-project needs `f[]=project_id&op[project_id]==&v[project_id][]=1&v[project_id][]=2`. |
| F2 | Shorthand params and `f[]` filters can be mixed | **They cannot.** As soon as any `f[]` is present Redmine silently ignores every shorthand filter — `?assigned_to_id=me&f[]=project_id&…` returned all 17 issues instead of the caller's 12. A poller built this way would leak other people's issues into the list. |
| F3 | Both modes default to the same status scope | **They differ.** Shorthand defaults to open issues; `f[]` mode defaults to *all* statuses. Status is now always set explicitly (`op[status_id]` = `o`/`c`/`*`). |
| F5 | `new URL()` is enough to validate a host | **It is not.** `ht!tp://%%%` parses to `https://ht!tp//%%%`, so a typo would reach the network layer and surface as an opaque failure. `normalizeHost` now checks the hostname shape and rejects non-http(s) schemes. |
| F4 | `Date#toISOString()` is an acceptable filter value | **422 `{"errors":["Updated is invalid"]}`.** Redmine rejects fractional seconds, so the delta poll would have failed on every call. `toRedmineTimestamp()` strips them. |

Confirmed as designed: `assigned_to_id=me` and `watcher_id=me` resolve server-side
(removing v1's currentUserId bootstrap); `updated_on=>=` gives a correct delta;
`limit` caps at 100; global `/trackers.json` works; and
`/enumerations/issue_priorities.json` returns data — v1's `getPriorities()` was
disabled with the comment *"Now not working in Redmine"*, which is no longer true.

Two environment fixes the compose file carries as a result:

- The `redmine` image ships **wget, not curl**, so the healthcheck uses wget.
- `REDMINE_SECRET_KEY_BASE` is only exported into the server's own process tree by
  the image entrypoint, so `docker compose exec … rails runner` cannot boot.
  The compose file sets `SECRET_KEY_BASE` directly instead.
- Host port defaults to **3001** (`REDMINE_PORT` overrides); 3000 collides too often.

### Design decisions taken during Stages 3–4

- **The delta floor is a server timestamp, not a local clock reading.**
  `syncMeta.lastPolledAt` holds the newest `updated_on` the server returned. The
  filter is evaluated against Redmine's clock, so using local time would silently
  drop issues updated inside any skew between the two. Retry backoff needs a local
  reading and therefore has its own field, `lastAttemptAt`.
- **The backfill never notifies.** On first run every issue is "new"; announcing
  three hundred of them is noise.
- **Read state is pruned alongside the issue cache**, so evicted issues do not
  leave orphaned entries behind.
- **Issues with a running timer or a queued time entry are pinned** and exempt
  from retention, so tracked work cannot be evicted out from under the user.

### Testing layers

| Layer | Environment | Covers |
|---|---|---|
| Unit | happy-dom (Node) | client, filters, error mapping, paging, unread/retention derivation, migration, poller logic |
| Component | happy-dom + @testing-library/svelte | component wiring, the Options save/permission/test flow |
| Integration | node (pinned per-file) | the real client against Redmine 7 in Docker; auto-skips when it is not running |
| Smoke | real browser | `dev/smoke.mjs` — every extension page mounts without runtime errors. Needs a browser that still honours `--load-extension`; see O4. |

The integration file is pinned to `// @vitest-environment node` on purpose: when
the suite default moved to happy-dom, its `fetch` could not reach the dev Redmine
and all fifteen tests began skipping silently rather than failing.

### Notes from Stages 6–7

- **`isWatched` is derived, not stored.** Every cached issue arrived via
  `assigned_to_id=me` or `watcher_id=me`, so "not assigned to me" is sufficient.
  This is why the poller caches the authenticated user (`local:currentUser`).
- **`localDateIso` instead of `toISOString().slice(0, 10)`.** `spent_on` must be
  the user's local day: the UTC slice puts an evening entry east of Greenwich on
  the following day, and a morning one west of it on the previous day. Migration
  had the same bug and now shares the helper.
- **The refresh button messages the worker** rather than re-implementing the
  delta poll in the UI, so there is one poller.
- **`roundHours` never rounds down to zero** — a 30-second session logs one
  increment rather than silently vanishing.

### Stage 8–9 notes

- **Firefox is MV2.** WXT's default for that target, because Firefox has no
  `sidePanel` API — the side panel maps onto `sidebar_action`, which is MV2-shaped.
  Chrome, the actual target, is MV3. Firefox also now needs an explicit extension
  id and a `data_collection_permissions` declaration; both are set, the latter to
  `none` because nothing is collected.
- **News is fetched on demand, not cached.** It is small and rarely read, so it
  does not earn a place in the storage schema or the poll cycle.
- **The projects view counts issues already in the cache** rather than querying
  per project, which would be one request per row.

## 7. Open questions

- **O1.** Does `chrome.notifications.onClicked` count as a user gesture for
  `chrome.sidePanel.open()`? Verify against a real Chrome in Stage 4. Fallback (and the current
  plan) is to route notification clicks to the tab page.
- ~~**O2.** `unlimitedStorage` may be droppable…~~ **Resolved:** the retention cap (90 days /
  500 issues, pinned entries exempt) holds, so the permission was never added. The manifest
  ships with `storage`, `alarms`, `notifications`, `contextMenus`, `sidePanel`, `tabs`.
- **O3.** Redmine renders descriptions as Textile or CommonMark depending on instance settings.
  v2.0 renders plain text + line breaks + linkification only. Revisit after Stage 6 if it reads badly.
- ~~**O4.** Playwright E2E via persistent-context extension loading — deferred.~~
  **Blocked by the browser, then replaced.** Chrome 151 has removed the
  `--load-extension` command-line switch from stable; the
  `DisableLoadExtensionCommandLineSwitch` feature flag no longer restores it, and
  `chrome://extensions-internals` confirms the extension simply never loads
  (headed or headless). `dev/smoke.mjs` is kept and detects this, printing the
  workaround (`npx playwright install chromium && node dev/smoke.mjs
  --channel=chromium`). In its place the suite gained **component tests**
  (happy-dom + @testing-library/svelte), which cover component wiring without a
  browser. Loading unpacked at `chrome://extensions` is unaffected.

- **O5.** The reactive stores are module-level singletons, so their `$state`
  outlives a test. `vi.resetModules()` cannot isolate them — it detaches
  `@wxt-dev/storage` from the fake browser. Component tests therefore isolate by
  resetting the underlying storage, which the singletons observe. Worth
  revisiting if store setup grows more complex.
