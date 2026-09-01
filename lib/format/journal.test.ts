import { describe, expect, it } from 'vitest';

import type { JournalDetail } from '@/lib/redmine';

import { buildContext, describeDetail } from './journal';

const context = buildContext({
  statuses: [{ id: 1, name: 'New' }, { id: 3, name: 'Resolved' }],
  trackers: [{ id: 1, name: 'Bug' }, { id: 2, name: 'Feature' }],
  priorities: [{ id: 4, name: 'Normal' }, { id: 5, name: 'High' }],
  users: [{ id: 7, name: 'Jane Doe' }],
});

const attr = (name: string, from: string | null, to: string | null): JournalDetail => ({
  property: 'attr',
  name,
  old_value: from,
  new_value: to,
});

describe('describeDetail', () => {
  it('resolves status ids to names', () => {
    expect(describeDetail(attr('status_id', '1', '3'), context)).toEqual({
      label: 'Status',
      kind: 'changed',
      from: 'New',
      to: 'Resolved',
    });
  });

  it('resolves trackers, priorities and users', () => {
    expect(describeDetail(attr('tracker_id', '1', '2'), context)).toMatchObject({
      label: 'Tracker', from: 'Bug', to: 'Feature',
    });
    expect(describeDetail(attr('priority_id', '4', '5'), context)).toMatchObject({
      label: 'Priority', from: 'Normal', to: 'High',
    });
    expect(describeDetail(attr('assigned_to_id', null, '7'), context)).toMatchObject({
      label: 'Assignee', kind: 'set', to: 'Jane Doe',
    });
  });

  it('falls back to the raw id when the lookup is missing', () => {
    expect(describeDetail(attr('status_id', '1', '99'), context).to).toBe('99');
    expect(describeDetail(attr('status_id', '1', '3'), {}).to).toBe('3');
  });

  it('formats percentages, hours and booleans', () => {
    expect(describeDetail(attr('done_ratio', '0', '40'), context)).toMatchObject({
      label: '% Done', from: '0%', to: '40%',
    });
    expect(describeDetail(attr('estimated_hours', null, '4.5'), context)).toMatchObject({
      label: 'Estimated time', to: '4.5h',
    });
    expect(describeDetail(attr('is_private', '0', '1'), context)).toMatchObject({
      label: 'Private', from: 'no', to: 'yes',
    });
  });

  it('reports a cleared field distinctly from a changed one', () => {
    expect(describeDetail(attr('due_date', '2026-09-01', null), context)).toMatchObject({
      label: 'Due date', kind: 'cleared', from: '2026-09-01',
    });
  });

  it('covers the fields v1 called "under development"', () => {
    // D9: v1's switch handled seven names and gave up on the rest.
    for (const [name, label] of [
      ['priority_id', 'Priority'],
      ['fixed_version_id', 'Target version'],
      ['start_date', 'Start date'],
      ['due_date', 'Due date'],
      ['parent_id', 'Parent task'],
      ['description', 'Description'],
      ['project_id', 'Project'],
    ] as const) {
      expect(describeDetail(attr(name, '1', '2'), context).label).toBe(label);
    }
  });

  it('names custom fields, falling back to the id', () => {
    const detail: JournalDetail = { property: 'cf', name: '12', old_value: 'a', new_value: 'b' };

    expect(describeDetail(detail, { ...context, customFields: { '12': 'Severity' } })).toMatchObject({
      label: 'Severity', from: 'a', to: 'b',
    });
    expect(describeDetail(detail, context).label).toBe('Custom field 12');
  });

  it('describes attachments and carries the id for linking', () => {
    const added: JournalDetail = {
      property: 'attachment', name: '55', old_value: null, new_value: 'design.pdf',
    };
    expect(describeDetail(added, context)).toEqual({
      label: 'Attachment', kind: 'added', to: 'design.pdf', from: undefined, attachmentId: 55,
    });
  });

  it('describes relations', () => {
    const detail: JournalDetail = {
      property: 'relation', name: 'relates', old_value: null, new_value: '99',
    };
    expect(describeDetail(detail, context)).toMatchObject({ label: 'Related issue', kind: 'added' });
  });

  it('humanises an unrecognised field instead of giving up', () => {
    expect(describeDetail(attr('some_new_field_id', '1', '2'), context).label).toBe('Some new field');
  });

  it('returns data only — no markup is ever produced', () => {
    // Any escaping is the renderer's job; nothing here builds HTML.
    const change = describeDetail(attr('subject', 'old', '<img src=x onerror=alert(1)>'), context);
    expect(change.to).toBe('<img src=x onerror=alert(1)>');
    expect(JSON.stringify(change)).not.toContain('<strong>');
  });
});
