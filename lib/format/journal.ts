import type { JournalDetail } from '@/lib/redmine';

/**
 * Turn a journal detail into a structured description.
 *
 * Structured, not HTML: v1's `issueHistory` directive assembled HTML strings
 * from `old_value`/`new_value` and injected them with `element.html(...)`, so an
 * issue subject containing markup executed inside the extension (D1). It also
 * only understood seven fields and fell through to "Sorry this is under
 * development" for priority, target version, dates, parent, relations and every
 * custom field (D9).
 */

export type ChangeKind = 'changed' | 'set' | 'cleared' | 'added' | 'removed' | 'unknown';

export interface JournalChange {
  label: string;
  kind: ChangeKind;
  from?: string;
  to?: string;
  /** Set for attachment details, so the component can link to the file. */
  attachmentId?: number;
}

export interface JournalContext {
  statuses?: Record<string, string>;
  trackers?: Record<string, string>;
  priorities?: Record<string, string>;
  users?: Record<string, string>;
  versions?: Record<string, string>;
  categories?: Record<string, string>;
  projects?: Record<string, string>;
  customFields?: Record<string, string>;
}

type Resolver = keyof JournalContext | 'raw' | 'percent' | 'hours' | 'boolean';

const FIELDS: Record<string, { label: string; via: Resolver }> = {
  status_id: { label: 'Status', via: 'statuses' },
  tracker_id: { label: 'Tracker', via: 'trackers' },
  priority_id: { label: 'Priority', via: 'priorities' },
  assigned_to_id: { label: 'Assignee', via: 'users' },
  author_id: { label: 'Author', via: 'users' },
  fixed_version_id: { label: 'Target version', via: 'versions' },
  category_id: { label: 'Category', via: 'categories' },
  project_id: { label: 'Project', via: 'projects' },
  parent_id: { label: 'Parent task', via: 'raw' },
  subject: { label: 'Subject', via: 'raw' },
  description: { label: 'Description', via: 'raw' },
  start_date: { label: 'Start date', via: 'raw' },
  due_date: { label: 'Due date', via: 'raw' },
  done_ratio: { label: '% Done', via: 'percent' },
  estimated_hours: { label: 'Estimated time', via: 'hours' },
  is_private: { label: 'Private', via: 'boolean' },
};

function resolve(value: string | null, via: Resolver, context: JournalContext): string | undefined {
  if (value === null || value === '') return undefined;

  switch (via) {
    case 'raw':
      return value;
    case 'percent':
      return `${value}%`;
    case 'hours': {
      const hours = Number(value);
      return Number.isFinite(hours) ? `${hours}h` : value;
    }
    case 'boolean':
      return value === '1' || value === 'true' ? 'yes' : 'no';
    default: {
      const table = context[via];
      // Fall back to the raw id — better a number than a blank.
      return table?.[value] ?? value;
    }
  }
}

function kindOf(from: string | undefined, to: string | undefined): ChangeKind {
  if (from === undefined && to !== undefined) return 'set';
  if (from !== undefined && to === undefined) return 'cleared';
  return 'changed';
}

export function describeDetail(
  detail: JournalDetail,
  context: JournalContext = {},
): JournalChange {
  if (detail.property === 'attachment') {
    const id = Number(detail.name);
    return {
      label: 'Attachment',
      kind: detail.new_value ? 'added' : 'removed',
      to: detail.new_value ?? undefined,
      from: detail.old_value ?? undefined,
      attachmentId: Number.isFinite(id) ? id : undefined,
    };
  }

  if (detail.property === 'relation') {
    return {
      label: 'Related issue',
      kind: detail.new_value ? 'added' : 'removed',
      to: detail.new_value ?? undefined,
      from: detail.old_value ?? undefined,
    };
  }

  if (detail.property === 'cf') {
    const label = context.customFields?.[detail.name] ?? `Custom field ${detail.name}`;
    const from = detail.old_value ?? undefined;
    const to = detail.new_value ?? undefined;
    return { label, kind: kindOf(from, to), from, to };
  }

  const field = FIELDS[detail.name];
  if (!field) {
    // Unknown but still worth showing, rather than v1's "under development".
    const from = detail.old_value ?? undefined;
    const to = detail.new_value ?? undefined;
    return { label: humanize(detail.name), kind: kindOf(from, to), from, to };
  }

  const from = resolve(detail.old_value, field.via, context);
  const to = resolve(detail.new_value, field.via, context);
  return { label: field.label, kind: kindOf(from, to), from, to };
}

/** `some_unknown_id` -> `Some unknown` */
function humanize(name: string): string {
  const words = name.replace(/_id$/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Build lookup tables from whatever is cached. */
export function buildContext(input: {
  statuses?: Array<{ id: number; name: string }>;
  trackers?: Array<{ id: number; name: string }>;
  priorities?: Array<{ id: number; name: string }>;
  users?: Array<{ id: number; name: string }>;
  projects?: Array<{ id: number; name: string }>;
}): JournalContext {
  const table = (list?: Array<{ id: number; name: string }>) =>
    list ? Object.fromEntries(list.map((entry) => [String(entry.id), entry.name])) : undefined;

  return {
    statuses: table(input.statuses),
    trackers: table(input.trackers),
    priorities: table(input.priorities),
    users: table(input.users),
    projects: table(input.projects),
  };
}
