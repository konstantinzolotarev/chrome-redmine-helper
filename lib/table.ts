/**
 * Filtering and paging for the full-page issue table.
 *
 * Pure, and deliberately separate from the component: the predicates are worth
 * testing on their own, and the table should not be the only thing that knows
 * what "open" means.
 */

import type { Issue, IssueStatus } from '@/lib/redmine';

/** `open`/`closed` collapse every status into the two cases people ask for. */
export type StatusFilter = number | 'open' | 'closed';

/**
 * Selections are unions: an empty list means "no constraint", and several
 * values mean "any of these" — the same semantics Redmine's own `v[field][]`
 * filters use, so this stays true if filtering ever moves server-side.
 */
export interface IssueFilters {
  query: string;
  projectIds: number[];
  statuses: StatusFilter[];
  trackerIds: number[];
}

export const NO_FILTERS: IssueFilters = {
  query: '',
  projectIds: [],
  statuses: [],
  trackerIds: [],
};

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/**
 * Coerce a stored page size to one we actually offer.
 *
 * Prefs sync between devices, so this value can arrive from a version that
 * offered different sizes — or from a profile stored before the field existed,
 * if its migration has not run yet. A bad size would otherwise reach
 * `pageSlice` and produce NaN bounds.
 */
export function normalizePageSize(value: unknown): number {
  return PAGE_SIZES.includes(value as (typeof PAGE_SIZES)[number])
    ? (value as number)
    : DEFAULT_PAGE_SIZE;
}

/**
 * Whether a status counts as open.
 *
 * A cached issue carries only `{ id, name }`, so closedness comes from the
 * enum cache. An unknown id counts as open — a status missing from a stale
 * cache should not hide the issue that uses it.
 */
function isOpen(statusId: number | undefined, statuses: IssueStatus[]): boolean {
  return statuses.find((status) => status.id === statusId)?.is_closed !== true;
}

function matchesStatus(issue: Issue, selected: StatusFilter[], statuses: IssueStatus[]): boolean {
  return selected.some((choice) => {
    if (choice === 'open') return isOpen(issue.status?.id, statuses);
    if (choice === 'closed') return !isOpen(issue.status?.id, statuses);
    return issue.status?.id === choice;
  });
}

export function filterIssues(
  issues: Issue[],
  filters: IssueFilters,
  statuses: IssueStatus[] = [],
): Issue[] {
  const needle = filters.query.trim().toLowerCase();

  return issues.filter((issue) => {
    if (needle && !issue.subject.toLowerCase().includes(needle) && !String(issue.id).includes(needle)) {
      return false;
    }

    const projectId = issue.project?.id;
    if (filters.projectIds.length > 0 && (projectId === undefined || !filters.projectIds.includes(projectId))) {
      return false;
    }

    const trackerId = issue.tracker?.id;
    if (filters.trackerIds.length > 0 && (trackerId === undefined || !filters.trackerIds.includes(trackerId))) {
      return false;
    }

    if (filters.statuses.length > 0 && !matchesStatus(issue, filters.statuses, statuses)) {
      return false;
    }

    return true;
  });
}

/** Every selected value across the dropdowns — the search box is not a filter. */
export function activeFilterCount(filters: IssueFilters): number {
  return filters.projectIds.length + filters.statuses.length + filters.trackerIds.length;
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, size)));
}

/**
 * Keep a page number in range.
 *
 * The list shrinks under the user — a filter narrows it, or a poll prunes it —
 * so the page held in component state can outlive the pages that exist.
 */
export function clampPage(page: number, total: number, size: number): number {
  return Math.min(Math.max(1, Math.trunc(page)), pageCount(total, size));
}

export function pageSlice<T>(items: T[], page: number, size: number): T[] {
  const start = (clampPage(page, items.length, size) - 1) * size;
  return items.slice(start, start + size);
}
