import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { buildContext } from '@/lib/format/journal';
import type { Attachment, Journal } from '@/lib/redmine';

import JournalEntry from './JournalEntry.svelte';

const context = buildContext({
  statuses: [{ id: 1, name: 'New' }, { id: 3, name: 'Resolved' }],
  priorities: [{ id: 4, name: 'Normal' }, { id: 5, name: 'High' }],
});

function journal(over: Partial<Journal> = {}): Journal {
  return {
    id: 1,
    user: { id: 7, name: 'Jane Doe' },
    notes: '',
    created_on: new Date(Date.now() - 3_600_000).toISOString(),
    details: [],
    ...over,
  };
}

describe('JournalEntry', () => {
  it('names who made the change', () => {
    render(JournalEntry, { props: { journal: journal(), context, host: 'https://redmine.test' } });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders a status change with both names resolved', () => {
    render(JournalEntry, {
      props: {
        journal: journal({
          details: [{ property: 'attr', name: 'status_id', old_value: '1', new_value: '3' }],
        }),
        context,
        host: 'https://redmine.test',
      },
    });

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders a priority change, which v1 could not', () => {
    // D9: v1's switch fell through to "Sorry this is under development".
    render(JournalEntry, {
      props: {
        journal: journal({
          details: [{ property: 'attr', name: 'priority_id', old_value: '4', new_value: '5' }],
        }),
        context,
        host: '',
      },
    });

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.queryByText(/under development/i)).not.toBeInTheDocument();
  });

  it('escapes a hostile subject change rather than rendering it', () => {
    const { container } = render(JournalEntry, {
      props: {
        journal: journal({
          details: [
            {
              property: 'attr',
              name: 'subject',
              old_value: 'fine',
              new_value: '<img src=x onerror="alert(1)">',
            },
          ],
        }),
        context,
        host: '',
      },
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('links an added attachment to its file', () => {
    const attachments: Attachment[] = [
      {
        id: 55,
        filename: 'design.pdf',
        filesize: 10,
        content_type: 'application/pdf',
        description: null,
        content_url: 'https://redmine.test/attachments/download/55/design.pdf',
        author: { id: 7, name: 'Jane Doe' },
        created_on: new Date().toISOString(),
      },
    ];

    const { container } = render(JournalEntry, {
      props: {
        journal: journal({
          details: [{ property: 'attachment', name: '55', old_value: null, new_value: 'design.pdf' }],
        }),
        context,
        host: 'https://redmine.test',
        attachments,
      },
    });

    expect(container.querySelector('a')).toHaveAttribute('href', attachments[0]!.content_url);
  });

  it('renders notes through the escaping renderer', () => {
    const { container } = render(JournalEntry, {
      props: {
        journal: journal({ notes: 'Looks good <b>to me</b>' }),
        context,
        host: '',
      },
    });

    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('Looks good <b>to me</b>');
  });
});
