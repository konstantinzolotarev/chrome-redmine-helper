# Dev Redmine

A throwaway Redmine 7 + Postgres 17 stack for developing and testing the extension.

## Start

```sh
docker compose -f dev/docker-compose.yml up -d
```

First boot takes a minute or two — Redmine runs its migrations on startup. Wait
for the container to report healthy:

```sh
docker compose -f dev/docker-compose.yml ps
```

## Seed

```sh
docker compose -f dev/docker-compose.yml exec redmine rails runner /dev-scripts/seed.rb
```

This is idempotent — re-running it is safe. It:

- loads Redmine's default data (trackers, statuses, priorities, time-entry
  activities, roles) — a fresh install has **none** of these, and without them
  the extension's enum endpoints return empty arrays
- enables the REST API (`Setting.rest_api_enabled`), which is **off by default**
  and is the single most common reason API calls 403
- sets the admin password and mints an API key, written to `dev/.api-key`
  (gitignored) and printed at the end of the run
- creates three extra users, two projects (`sandbox`, `side-quest` — the second
  exists to exercise project filtering), memberships, 15 issues with journals
  and watchers, time entries and news

## Connect the extension

| Field   | Value                       |
| ------- | --------------------------- |
| Host    | `http://localhost:3001`     |
| API key | contents of `dev/.api-key`  |

Web login is `admin` / `redminedev123`.

Note that Options must be granted host permission for `http://localhost:3001/*`
before any request will succeed — Redmine sends no CORS headers, so the browser
blocks cross-origin requests to origins the extension does not hold permission
for. The "Test connection" button reports this explicitly.

## Reset

Wipes the database and uploaded files, so the next `up` starts from scratch:

```sh
docker compose -f dev/docker-compose.yml down -v
```

## Logs

```sh
docker compose -f dev/docker-compose.yml logs -f redmine
```
