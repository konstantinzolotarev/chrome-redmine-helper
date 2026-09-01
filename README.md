# Redmine Helper

Work with your Redmine issues without opening Redmine.

Redmine Helper keeps the issues assigned to you — and the ones you watch — in
Chrome's side panel, next to whatever you're actually working on. It tells you
when something changes, and lets you act on it in place: change a status, log
time, reply to a comment.

Version 2.0 is a ground-up rewrite on **Svelte 5 + TypeScript + Manifest V3**,
replacing the AngularJS 1.0 / Bootstrap 2 / jQuery extension originally written
in 2012.

---

## Features

**Issue list.** Everything assigned to you plus everything you watch, searchable,
with unread tracking and a toolbar badge. Unread is derived from Redmine's own
`updated_on` against when you last opened an issue, so it stays accurate across
refetches.

**Edit in place.** Status, tracker, priority, assignee, % done and estimated
hours are editable directly from the issue view. Changes apply optimistically and
roll back if Redmine rejects them.

**Full history.** Every journal entry rendered properly — including target
version, dates, parent, relations and custom fields — plus comments and file
attachments.

**Time tracking that reaches Redmine.** Start a timer on an issue; stopping it
opens a form that posts a real time entry. Sessions that fail to send are queued
locally with the reason attached, and can be edited and retried from the Time log
screen. Nothing is discarded silently.

**Create from anywhere.** Select text on any page, right-click, and get a
pre-filled new issue.

**Full page view.** A wide issue table with configurable columns, project and
news browsers, the new-issue form, and the time-log queue.

**Notifications.** Optional desktop notifications for new or updated issues.

**Dark mode**, following your system setting or pinned explicitly.

---

## Requirements

- Chrome 114+ (for the side panel API)
- Redmine 5.0 or later, with the REST API enabled
- An API access key from your Redmine account page

Tested against Redmine 7.0; the endpoints used are stable across 5.x, 6.x and 7.x.

---

## Install

### From source

```sh
git clone https://github.com/konstantinzolotarev/chrome-redmine-helper.git
cd chrome-redmine-helper
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, choose **Load
unpacked**, and select `.output/chrome-mv3`.

> Chrome 151 removed the `--load-extension` command-line switch, so loading
> through that page is the only way — launching Chrome with a flag no longer
> works.

---

## First run

Open the extension's options and fill in:

| Field       | Value                                                           |
| ----------- | --------------------------------------------------------------- |
| Redmine host | The root URL, e.g. `https://redmine.example.com`                |
| API access key | From your Redmine account page, usually in the right column  |

Press **Save & test connection**. Chrome will ask for permission to access that
one host — this is required, and nothing will load without it.

### If it doesn't connect

The connection test names the actual problem, but these are the two common ones:

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Redmine refused the request" | The REST API is off — it is disabled by default | Administration → Settings → API → *Enable REST web service* |
| "Access to that host was not granted" | Chrome blocked the permission prompt, or it was dismissed | Reopen Options and press Save & test again |
| "Redmine rejected the API key" | Wrong or rotated key | Copy a fresh one from your account page |
| "Did not answer like a Redmine instance" | URL points at a sub-page or a login redirect | Use the root URL |

Redmine sends no CORS headers, so the browser blocks any request to an origin the
extension doesn't hold permission for. That's why the permission step is not
optional, and why a missing grant looks identical to being offline unless
something explains it.

---

## How it works

`chrome.storage` is the single source of truth. The service worker polls Redmine
and writes results; the UI reads through Svelte stores that subscribe to
`storage.onChanged`. Both import the same API client. Mark an issue read in the
side panel and the open tab updates on its own, with no message passing.

```
  ┌─ service worker ─┐      ┌─ side panel ─┐   ┌─ tab page ─┐
  │ alarm: delta     │      │ Svelte 5 app │   │ Svelte app │
  │ poll, badge,     │      │ user actions │   │            │
  │ notifications    │      └──────┬───────┘   └─────┬──────┘
  └────────┬─────────┘             │                 │
           │      both contexts import               │
           └────────────► lib/redmine ◄──────────────┘
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

Polling asks only for issues changed since the last check
(`updated_on>=`), using the newest server timestamp as the floor rather than the
local clock — so clock skew between browser and server can't drop updates.

---

## Development

```sh
npm run dev            # dev build with HMR -> .output/chrome-mv3
npm run build          # production build
npm run build:firefox  # Firefox build (MV2 — Firefox has no sidePanel API)
npm run zip            # packaged for the store
npm run check          # svelte-check + TypeScript
npm test               # unit + component + integration tests
npm run smoke          # load the built extension in a browser and check it mounts
```

### Local Redmine

`dev/` contains a throwaway Redmine 7 + Postgres stack and an idempotent seed
script, so you can develop against real data. See [dev/README.md](dev/README.md).

```sh
docker compose -f dev/docker-compose.yml up -d
docker compose -f dev/docker-compose.yml exec redmine rails runner /dev-scripts/seed.rb
```

It seeds two projects, several users, issues with journals and watchers, time
entries and news, then prints an API key (also written to `dev/.api-key`).
Defaults to port **3001**; override with `REDMINE_PORT`.

### Testing

| Layer | Environment | Covers |
| --- | --- | --- |
| Unit | happy-dom | API client, filters, error mapping, paging, unread/retention logic, migration, poller |
| Component | @testing-library/svelte | component wiring, the Options connect flow, escaping |
| Integration | node | the real client against Redmine in Docker — skips automatically when it isn't running |
| Smoke | real browser | `dev/smoke.mjs` — every page mounts without runtime errors |

### Layout

```
entrypoints/    background worker, side panel, tab page, options
lib/redmine/    API client — no extension APIs, testable in isolation
lib/store/      storage schema, reactive bridge, derived state
lib/sync/       background poller, notifications, badge
lib/actions/    user-initiated operations
lib/format/     journal and text rendering
components/     Svelte components
dev/            Docker Redmine, seed script, smoke test
docs/plans/     design notes for the 2.0 rewrite
```

---

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Settings, cached issues, timers |
| `alarms` | Periodic background poll |
| `notifications` | Optional desktop notifications |
| `contextMenus` | "Create new Redmine issue" on selected text |
| `sidePanel` | The main UI |
| `tabs` | Focus the extension's own tab instead of opening duplicates |
| `optional_host_permissions` | Requested at runtime **for your Redmine host only** — never granted broadly |

Version 1.x requested `*://*/*` up front. 2.0 asks for the one origin you
configure, when you configure it.

---

## Upgrading from 1.6.6

Settings migrate automatically on update.

Time tracked in 1.x — which that version stored locally and **never sent to
Redmine** — is converted into queued time entries you can review, edit and log
from the Time log screen.

Your API key moves from synced storage to local storage, so it no longer travels
through your Google account. ChiliProject support has been removed; that project
has been archived since 2015.

---

## Privacy

Everything stays in your browser. The extension talks only to the Redmine host
you configure and sends nothing anywhere else. No analytics, no telemetry, no
third-party requests.
