import { describe, expect, it } from 'vitest';

import type { Issue, IssueStatus } from '@/lib/redmine';

import {
  activeFilterCount,
  clampPage,
  DEFAULT_PAGE_SIZE,
  filterIssues,
  normalizePageSize,
  NO_FILTERS,
  pageCount,
  pageSlice,
} from './table';

const STATUSES: IssueStatus[] = [
  { id: 1, name: 'New' },
  { id: 2, name: 'In Progress' },
  { id: 5, name: 'Closed', is_closed: true },
];

function issue(id: number, over: Partial<Issue> = {}): Issue {
  return {
    id,
    subject: `Issue ${id}`,
    project: { id: 1, name: 'Sandbox' },
    tracker: { id: 1, name: 'Bug' },
    status: { id: 1, name: 'New' },
    ...over,
  } as Issue;
}

const ids = (list: Issue[]) => list.map((entry) => entry.id);

describe('filterIssues', () => {
  const list = [
    issue(1),
    issue(2, { project: { id: 2, name: 'Website' }, tracker: { id: 3, name: 'Feature' } }),
    issue(3, { status: { id: 5, name: 'Closed' } }),
    issue(4, { subject: 'Broken login' }),
  ];

  it('returns everything when nothing is set', () => {
    expect(filterIssues(list, NO_FILTERS, STATUSES)).toHaveLength(4);
  });

  it('matches the query against subject and id', () => {
    expect(ids(filterIssues(list, { ...NO_FILTERS, query: 'login' }, STATUSES))).toEqual([4]);
    expect(ids(filterIssues(list, { ...NO_FILTERS, query: '2' }, STATUSES))).toEqual([2]);
  });

  it('filters by project and by tracker', () => {
    expect(ids(filterIssues(list, { ...NO_FILTERS, projectIds: [2] }, STATUSES))).toEqual([2]);
    expect(ids(filterIssues(list, { ...NO_FILTERS, trackerIds: [3] }, STATUSES))).toEqual([2]);
  });

  it('unions several values within one filter', () => {
    const both = filterIssues(list, { ...NO_FILTERS, projectIds: [1, 2] }, STATUSES);
    expect(ids(both)).toEqual([1, 2, 3, 4]);
  });

  it('intersects across filters', () => {
    // Any-of within a filter, all-of between them.
    const filtered = filterIssues(
      list,
      { ...NO_FILTERS, projectIds: [1, 2], trackerIds: [3] },
      STATUSES,
    );
    expect(ids(filtered)).toEqual([2]);
  });

  it('filters by an exact status', () => {
    expect(ids(filterIssues(list, { ...NO_FILTERS, statuses: [5] }, STATUSES))).toEqual([3]);
  });

  it('splits open from closed using the status enum', () => {
    // A cached issue carries only { id, name }, so closedness comes from there.
    expect(ids(filterIssues(list, { ...NO_FILTERS, statuses: ['open'] }, STATUSES))).toEqual([1, 2, 4]);
    expect(ids(filterIssues(list, { ...NO_FILTERS, statuses: ['closed'] }, STATUSES))).toEqual([3]);
  });

  it('mixes the open shorthand with an explicit status', () => {
    expect(ids(filterIssues(list, { ...NO_FILTERS, statuses: ['closed', 1] }, STATUSES))).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('treats an unknown status as open rather than hiding the issue', () => {
    // A status missing from a stale enum cache must not swallow its issues.
    expect(ids(filterIssues(list, { ...NO_FILTERS, statuses: ['open'] }, []))).toEqual([1, 2, 3, 4]);
  });

  it('excludes an issue with no project when projects are selected', () => {
    const orphan = [issue(9, { project: undefined })] as Issue[];
    expect(filterIssues(orphan, { ...NO_FILTERS, projectIds: [1] }, STATUSES)).toHaveLength(0);
  });

  it('combines filters', () => {
    const filtered = filterIssues(
      list,
      { query: 'Issue', projectIds: [1], statuses: ['open'], trackerIds: [1] },
      STATUSES,
    );
    expect(ids(filtered)).toEqual([1]);
  });
});

describe('activeFilterCount', () => {
  it('counts every selected value, but never the search box', () => {
    expect(activeFilterCount({ ...NO_FILTERS, query: 'anything' })).toBe(0);
    expect(activeFilterCount({ ...NO_FILTERS, projectIds: [1, 2], statuses: ['open'] })).toBe(3);
  });
});

describe('normalizePageSize', () => {
  it('accepts the sizes we offer', () => {
    expect(normalizePageSize(50)).toBe(50);
  });

  it('falls back for anything else', () => {
    // Prefs sync between devices and can predate the field entirely; a bad
    // size would reach pageSlice and produce NaN bounds.
    for (const bad of [undefined, null, 0, -1, 37, NaN, '50']) {
      expect(normalizePageSize(bad)).toBe(DEFAULT_PAGE_SIZE);
    }
  });
});

describe('paging', () => {
  const list = Array.from({ length: 57 }, (_, index) => issue(index + 1));

  it('counts pages, never fewer than one', () => {
    expect(pageCount(57, 25)).toBe(3);
    expect(pageCount(50, 25)).toBe(2);
    expect(pageCount(0, 25)).toBe(1);
  });

  it('slices the requested page', () => {
    expect(ids(pageSlice(list, 1, 25))).toHaveLength(25);
    expect(pageSlice(list, 1, 25)[0]?.id).toBe(1);
    expect(pageSlice(list, 2, 25)[0]?.id).toBe(26);
    expect(pageSlice(list, 3, 25)).toHaveLength(7);
  });

  it('clamps a page that no longer exists', () => {
    // The list shrinks under the user: a filter narrows it, or a poll prunes it.
    expect(clampPage(9, 57, 25)).toBe(3);
    expect(clampPage(0, 57, 25)).toBe(1);
    expect(clampPage(3, 0, 25)).toBe(1);
  });

  it('slices through the clamp, so an out-of-range page still shows the last one', () => {
    expect(pageSlice(list, 99, 25)[0]?.id).toBe(51);
  });
});
