/**
 * Split Redmine text into renderable segments.
 *
 * Returns data, never HTML. v1 pushed notes and descriptions through an
 * `nl2br` filter into `ng-bind-html`, which meant any HTML in an issue was
 * live in the extension's own context. The component renders these segments
 * with ordinary Svelte interpolation, so escaping is automatic.
 */

export type Segment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string }
  | { type: 'issue'; value: string; id: number };

// Bare URLs, and Redmine's #1234 issue references.
const PATTERN = /(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])|(?:(?<![\w#])#(\d+)\b)/g;

/** Trailing punctuation should not be swallowed into a link. */
function trimUrl(raw: string): { url: string; trailing: string } {
  const match = /[.,;:!?)\]]+$/.exec(raw);
  if (!match) return { url: raw, trailing: '' };
  return { url: raw.slice(0, match.index), trailing: raw.slice(match.index) };
}

export function tokenize(text: string | null | undefined): Segment[] {
  if (!text) return [];

  const segments: Segment[] = [];
  let lastIndex = 0;

  const push = (value: string) => {
    if (value) segments.push({ type: 'text', value });
  };

  for (const match of text.matchAll(PATTERN)) {
    const index = match.index ?? 0;
    push(text.slice(lastIndex, index));

    if (match[1]) {
      const { url, trailing } = trimUrl(match[1]);
      segments.push({ type: 'url', value: url });
      push(trailing);
    } else if (match[2]) {
      segments.push({ type: 'issue', value: match[0], id: Number(match[2]) });
    }

    lastIndex = index + match[0].length;
  }

  push(text.slice(lastIndex));
  return segments;
}

/** Absolute URL of an issue in the Redmine web UI. */
export function issueUrl(host: string, id: number): string {
  return `${host.replace(/\/+$/, '')}/issues/${id}`;
}
