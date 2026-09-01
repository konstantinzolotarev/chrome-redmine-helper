import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

import { DEFAULT_PREFS } from '@/lib/store/defaults';
import { prefsItem, secretsItem, unsentSessionsItem } from '@/lib/store/items';

import {
  extractSubjects,
  mapProfile,
  mapTimelines,
  migrateFromV1,
  type V1Profile,
  type V1Timelines,
} from './v1';

/** A realistic 1.6.6 profile, matching the shape v1's Config class wrote. */
const V1_PROFILE: V1Profile = {
  chiliProject: false,
  host: 'https://redmine.example.com/',
  apiAccessKey: 'legacy-api-key',
  useHttpAuth: true,
  httpUser: 'proxyuser',
  httpPass: 'proxypass',
  selectedProject: 4,
  currentUserName: 'Jane Doe',
  currentUserId: 12,
  hideHints: true,
  notifications: { show: 'updated' },
  projects: { show_for: 'selected', list: [3, 7] },
  table: { id: true, project: true, author: false, tracker: true, status: false },
};

describe('mapProfile', () => {
  it('carries connection settings across, splitting secrets out of sync', () => {
    const { prefs, secrets } = mapProfile(V1_PROFILE);

    expect(prefs.host).toBe('https://redmine.example.com');
    expect(prefs.useHttpAuth).toBe(true);
    expect(prefs.httpUser).toBe('proxyuser');

    // Credentials must land in local storage, not sync.
    expect(secrets.apiKey).toBe('legacy-api-key');
    expect(secrets.httpPassword).toBe('proxypass');
  });

  it('carries notification, project-filter and column preferences', () => {
    const { prefs } = mapProfile(V1_PROFILE);

    expect(prefs.notifications.mode).toBe('updated');
    expect(prefs.projectFilter).toEqual({ mode: 'selected', projectIds: [3, 7] });
    expect(prefs.columns).toEqual({
      id: true,
      project: true,
      author: false,
      tracker: true,
      status: false,
    });
  });

  it('drops settings that no longer exist', () => {
    const { prefs } = mapProfile(V1_PROFILE);
    expect(prefs).not.toHaveProperty('chiliProject');
    expect(prefs).not.toHaveProperty('hideHints');
    expect(prefs).not.toHaveProperty('currentUserId');
  });

  it('falls back to defaults for a missing or empty profile', () => {
    expect(mapProfile(undefined).prefs).toEqual(DEFAULT_PREFS);
    expect(mapProfile({}).prefs.host).toBe('');
    expect(mapProfile({}).secrets.apiKey).toBe('');
  });

  it('rejects unknown enum values rather than carrying them forward', () => {
    const { prefs } = mapProfile({
      notifications: { show: 'sometimes' },
      projects: { show_for: 'whatever', list: [1] },
    });
    expect(prefs.notifications.mode).toBe(DEFAULT_PREFS.notifications.mode);
    expect(prefs.projectFilter.mode).toBe('all');
  });

  it('drops a host that cannot be parsed', () => {
    expect(mapProfile({ host: 'ht!tp://%%%' }).prefs.host).toBe('');
  });
});

describe('mapTimelines', () => {
  const newId = (() => {
    let n = 0;
    return () => `id-${(n += 1)}`;
  })();

  const timelines: V1Timelines = {
    '101': [
      {
        issueId: 101,
        start: '2026-08-30T09:00:00.000Z',
        end: '2026-08-30T10:30:00.000Z',
        spent: 5_400_000,
      },
      // Still running when v1 was last used: no end, nothing to log.
      { issueId: 101, start: '2026-08-31T09:00:00.000Z' },
    ],
    '202': [
      // No `spent` — older v1 entries relied on end - start.
      { issueId: 202, start: '2026-08-29T13:00:00.000Z', end: '2026-08-29T13:20:00.000Z' },
    ],
  };

  it('converts completed sessions into queued time entries', () => {
    const sessions = mapTimelines(timelines, { newId });

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      issueId: 101,
      hours: 1.5,
      spentOn: '2026-08-30',
      activityId: null,
      attempts: 0,
    });
  });

  it('derives hours from start/end when `spent` is absent', () => {
    const sessions = mapTimelines(timelines, { newId });
    // 20 minutes -> 0.33h, rounded to the 0.25 increment.
    expect(sessions.find((s) => s.issueId === 202)?.hours).toBe(0.25);
  });

  it('skips sessions that were never stopped', () => {
    const sessions = mapTimelines(timelines, { newId });
    expect(sessions.every((s) => s.endedAt)).toBe(true);
  });

  it('skips malformed and zero-length entries', () => {
    const sessions = mapTimelines(
      {
        '1': [
          { issueId: 1, start: 'nonsense', end: '2026-08-30T10:00:00Z' },
          { issueId: 1, start: '2026-08-30T10:00:00Z', end: '2026-08-30T10:00:00Z' },
          { issueId: 1, start: '2026-08-30T11:00:00Z', end: '2026-08-30T10:00:00Z' },
        ],
      },
      { newId },
    );
    expect(sessions).toHaveLength(0);
  });

  it('labels sessions with the subject from v1\'s issue cache', () => {
    const sessions = mapTimelines(timelines, {
      newId,
      subjects: { '101': 'Fix the login form' },
    });

    expect(sessions.find((s) => s.issueId === 101)?.issueSubject).toBe('Fix the login form');
    // Falls back to the id when v1 never cached the issue.
    expect(sessions.find((s) => s.issueId === 202)?.issueSubject).toBe('Issue #202');
  });

  it('returns nothing for missing input', () => {
    expect(mapTimelines(undefined)).toEqual([]);
    expect(mapTimelines({})).toEqual([]);
  });
});

describe('extractSubjects', () => {
  it('reads subjects out of v1\'s nested issue cache', () => {
    expect(
      extractSubjects({ issues: { '5': { subject: 'Hello' }, '6': { subject: 'World' } } }),
    ).toEqual({ '5': 'Hello', '6': 'World' });
  });

  it('tolerates junk', () => {
    expect(extractSubjects(null)).toEqual({});
    expect(extractSubjects({})).toEqual({});
    expect(extractSubjects({ issues: 'nope' })).toEqual({});
  });
});

describe('migrateFromV1', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  async function seedLegacyStorage() {
    await fakeBrowser.storage.sync.set({ profile: V1_PROFILE });
    await fakeBrowser.storage.local.set({
      profile: undefined,
      issues: { issues: { '101': { subject: 'Fix the login form' } } },
      projects: { '1': { name: 'Old cache' } },
      users: { '1': { name: 'Old cache' } },
      timelines: {
        '101': [
          {
            issueId: 101,
            start: '2026-08-30T09:00:00.000Z',
            end: '2026-08-30T10:30:00.000Z',
            spent: 5_400_000,
          },
        ],
      },
    });
  }

  it('does nothing on a fresh install', async () => {
    const result = await migrateFromV1();
    expect(result).toEqual({ migrated: false, hadProfile: false, carriedSessions: 0 });
  });

  it('moves settings, secrets and tracked time to the new shape', async () => {
    await seedLegacyStorage();

    const result = await migrateFromV1();
    expect(result).toMatchObject({ migrated: true, hadProfile: true, carriedSessions: 1 });

    expect((await prefsItem.getValue()).host).toBe('https://redmine.example.com');
    expect((await secretsItem.getValue()).apiKey).toBe('legacy-api-key');

    const sessions = await unsentSessionsItem.getValue();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      issueId: 101,
      hours: 1.5,
      issueSubject: 'Fix the login form',
    });
  });

  it('clears the legacy keys so it will not run twice', async () => {
    await seedLegacyStorage();
    await migrateFromV1();

    expect(await fakeBrowser.storage.sync.get('profile')).toEqual({});
    expect(await fakeBrowser.storage.local.get(['issues', 'projects', 'users', 'timelines'])).toEqual({});

    const second = await migrateFromV1();
    expect(second.migrated).toBe(false);
    // The first run's sessions must not be duplicated.
    expect(await unsentSessionsItem.getValue()).toHaveLength(1);
  });

  it('migrates tracked time even when no profile was ever saved', async () => {
    await fakeBrowser.storage.local.set({
      timelines: {
        '7': [{ issueId: 7, start: '2026-08-30T09:00:00.000Z', end: '2026-08-30T11:00:00.000Z' }],
      },
    });

    const result = await migrateFromV1();
    expect(result).toMatchObject({ migrated: true, hadProfile: false, carriedSessions: 1 });
    expect((await unsentSessionsItem.getValue())[0]).toMatchObject({ issueId: 7, hours: 2 });
  });
});
