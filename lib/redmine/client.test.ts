import { describe, expect, it, vi } from 'vitest';

import { MAX_PAGE_SIZE, RedmineClient, normalizeHost, originPattern } from './client';
import { RedmineError } from './errors';
import { toFilterParams } from './filters';
import { toIssueParams, toRedmineTimestamp } from './issues';

/** A fetch stub that records requests and replays queued responses. */
function stubFetch(responses: Array<{ status?: number; body?: unknown; text?: string; headers?: Record<string, string> }>) {
  const calls: Request[] = [];
  const queue = [...responses];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(String(input), init));
    const next = queue.shift() ?? { status: 200, body: {} };
    const status = next.status ?? 200;
    const body = next.text ?? (next.body === undefined ? '' : JSON.stringify(next.body));
    // 204/205/304 must be constructed with a null body or Response throws.
    const nullBody = status === 204 || status === 205 || status === 304;
    return new Response(nullBody ? null : body, {
      status,
      headers: { 'Content-Type': 'application/json', ...next.headers },
    });
  });

  return { fetchMock: fetchMock as unknown as typeof globalThis.fetch, calls };
}

function client(
  responses: Parameters<typeof stubFetch>[0],
  credentials: Partial<ConstructorParameters<typeof RedmineClient>[0]> = {},
) {
  const { fetchMock, calls } = stubFetch(responses);
  const instance = new RedmineClient(
    { host: 'https://redmine.test', apiKey: 'secret-key', ...credentials },
    { fetch: fetchMock },
  );
  return { instance, calls };
}

describe('normalizeHost', () => {
  it('defaults to https when no scheme is given', () => {
    expect(normalizeHost('redmine.example.com')).toBe('https://redmine.example.com');
  });

  it('strips trailing slashes', () => {
    expect(normalizeHost('https://redmine.example.com///')).toBe('https://redmine.example.com');
  });

  it('preserves a sub-path mount', () => {
    expect(normalizeHost('https://example.com/redmine/')).toBe('https://example.com/redmine');
  });

  it('keeps an explicit port and http scheme', () => {
    expect(normalizeHost('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it('rejects an empty host', () => {
    expect(() => normalizeHost('   ')).toThrow(RedmineError);
  });

  it('rejects hostnames the URL parser accepts but no resolver will answer', () => {
    // `new URL()` alone yields "https://ht!tp//%%%" for this, which would fail
    // much later as an opaque network error instead of at the point of entry.
    expect(() => normalizeHost('ht!tp://%%%')).toThrow(RedmineError);
    expect(() => normalizeHost('spaces in host')).toThrow(RedmineError);
  });

  it('rejects a non-http scheme instead of prefixing https', () => {
    expect(() => normalizeHost('ftp://redmine.example.com')).toThrow(/http or https/);
  });

  it('accepts IP literals', () => {
    expect(normalizeHost('192.168.1.10:3000')).toBe('https://192.168.1.10:3000');
  });
});

describe('originPattern', () => {
  it('produces a match pattern for chrome.permissions', () => {
    expect(originPattern('https://example.com/redmine/')).toBe('https://example.com/*');
    expect(originPattern('localhost:3001')).toBe('https://localhost:3001/*');
  });
});

describe('authentication headers', () => {
  it('sends the API key as a header, never as a query parameter', async () => {
    const { instance, calls } = client([{ body: { user: {} } }]);
    await instance.get('/users/current.json');

    expect(calls[0]!.headers.get('X-Redmine-API-Key')).toBe('secret-key');
    expect(calls[0]!.url).not.toContain('secret-key');
  });

  it('omits ambient cookies so the API key is the only credential', async () => {
    const { instance, calls } = client([{ body: {} }]);
    await instance.get('/issues.json');
    expect(calls[0]!.credentials).toBe('omit');
  });

  it('adds HTTP Basic alongside the API key when enabled', async () => {
    const { instance, calls } = client([{ body: {} }], {
      useHttpAuth: true,
      httpUser: 'proxy',
      httpPassword: 'pw',
    });
    await instance.get('/issues.json');

    expect(calls[0]!.headers.get('Authorization')).toBe(`Basic ${btoa('proxy:pw')}`);
    expect(calls[0]!.headers.get('X-Redmine-API-Key')).toBe('secret-key');
  });

  it('encodes non-Latin1 credentials as UTF-8 rather than throwing', async () => {
    const { instance, calls } = client([{ body: {} }], {
      useHttpAuth: true,
      httpUser: 'user',
      httpPassword: 'pÄssword—ü',
    });
    await expect(instance.get('/issues.json')).resolves.toBeDefined();

    const header = calls[0]!.headers.get('Authorization')!;
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(header.replace('Basic ', '')), (c) => c.charCodeAt(0)),
    );
    expect(decoded).toBe('user:pÄssword—ü');
  });

  it('leaves Basic off when the toggle is disabled', async () => {
    const { instance, calls } = client([{ body: {} }], {
      useHttpAuth: false,
      httpUser: 'proxy',
      httpPassword: 'pw',
    });
    await instance.get('/issues.json');
    expect(calls[0]!.headers.get('Authorization')).toBeNull();
  });
});

describe('query encoding', () => {
  it('repeats keys for array values instead of pipe-joining', async () => {
    const { instance, calls } = client([{ body: {} }]);
    await instance.get('/issues.json', { 'f[]': ['a', 'b'], 'v[project_id][]': [1, 2] });

    const query = new URL(calls[0]!.url).searchParams;
    expect(query.getAll('f[]')).toEqual(['a', 'b']);
    expect(query.getAll('v[project_id][]')).toEqual(['1', '2']);
    // `project_id=1|2` is a 404 on Redmine — guard against regressing to it.
    expect(calls[0]!.url).not.toContain('%7C');
  });

  it('drops undefined, null and empty values', async () => {
    const { instance, calls } = client([{ body: {} }]);
    await instance.get('/issues.json', { a: undefined, b: null, c: '', d: 0, e: false });

    const query = new URL(calls[0]!.url).searchParams;
    expect([...query.keys()].sort()).toEqual(['d', 'e']);
  });
});

describe('toIssueParams', () => {
  it('emits the f[]/op/v filter form', () => {
    const params = toIssueParams({ assignedToMe: true, projectIds: [3, 7] });

    expect(params['f[]']).toEqual(['assigned_to_id', 'project_id', 'status_id']);
    expect(params['op[assigned_to_id]']).toBe('=');
    expect(params['v[assigned_to_id][]']).toEqual(['me']);
    expect(params['op[project_id]']).toBe('=');
    expect(params['v[project_id][]']).toEqual([3, 7]);
  });

  it('always sets a status operator, defaulting to open', () => {
    // f[] mode defaults to ALL statuses, unlike shorthand mode — so leaving this
    // implicit would silently widen every query.
    expect(toIssueParams({})['op[status_id]']).toBe('o');
    expect(toIssueParams({ status: 'closed' })['op[status_id]']).toBe('c');
    expect(toIssueParams({ status: 'all' })['op[status_id]']).toBe('*');
  });

  it('never mixes shorthand parameters with f[] filters', () => {
    // Redmine ignores shorthand entirely once any f[] is present.
    const params = toIssueParams({ assignedToMe: true, watchedByMe: true, projectIds: [1] });
    for (const key of ['assigned_to_id', 'watcher_id', 'project_id', 'status_id']) {
      expect(params[key]).toBeUndefined();
    }
  });

  it('uses the contains operator for subject search', () => {
    const params = toIssueParams({ subject: 'login' });
    expect(params['op[subject]']).toBe('~');
    expect(params['v[subject][]']).toEqual(['login']);
  });

  it('sorts by most recently updated by default', () => {
    expect(toIssueParams({}).sort).toBe('updated_on:desc');
    expect(toIssueParams({ sort: 'id:asc' }).sort).toBe('id:asc');
  });
});

describe('toRedmineTimestamp', () => {
  it('strips milliseconds, which Redmine rejects as "Updated is invalid"', () => {
    expect(toRedmineTimestamp(new Date('2026-09-01T10:20:30.456Z'))).toBe('2026-09-01T10:20:30Z');
  });

  it('passes strings through untouched', () => {
    expect(toRedmineTimestamp('2026-09-01')).toBe('2026-09-01');
  });
});

describe('toFilterParams', () => {
  it('returns nothing for an empty filter list', () => {
    expect(toFilterParams([])).toEqual({});
  });

  it('omits the value key for value-less operators', () => {
    const params = toFilterParams([{ field: 'status_id', operator: 'o' }]);
    expect(params['op[status_id]']).toBe('o');
    expect(params['v[status_id][]']).toBeUndefined();
  });
});

describe('error mapping', () => {
  const cases: Array<[number, string]> = [
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'server'],
  ];

  it.each(cases)('maps %i to %s', async (status, kind) => {
    const { instance } = client([{ status, body: {} }]);
    await expect(instance.get('/issues.json')).rejects.toMatchObject({ kind, status });
  });

  it('extracts validation messages from a 422', async () => {
    const { instance } = client([
      { status: 422, body: { errors: ["Subject can't be blank", 'Tracker is invalid'] } },
    ]);

    const error = (await instance.post('/issues.json', {}).catch((e) => e)) as RedmineError;
    expect(error.kind).toBe('validation');
    expect(error.errors).toEqual(["Subject can't be blank", 'Tracker is invalid']);
    expect(error.describe()).toContain("Subject can't be blank");
  });

  it('survives a 422 whose body is not the documented shape', async () => {
    const { instance } = client([{ status: 422, text: '<html>nope</html>' }]);
    const error = (await instance.post('/issues.json', {}).catch((e) => e)) as RedmineError;
    expect(error.kind).toBe('validation');
    expect(error.errors).toEqual([]);
  });

  it('reports non-JSON success bodies as a parse error', async () => {
    const { instance } = client([{ text: '<html>login page</html>' }]);
    await expect(instance.get('/issues.json')).rejects.toMatchObject({ kind: 'parse' });
  });

  it('classifies a rejected fetch as a network error', async () => {
    const failing = new RedmineClient(
      { host: 'https://redmine.test', apiKey: 'k' },
      { fetch: (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof globalThis.fetch },
    );
    const error = (await failing.get('/issues.json').catch((e) => e)) as RedmineError;
    expect(error.kind).toBe('network');
    // Missing host permission surfaces as an opaque CORS failure — the message
    // has to point at that, since it is the most common cause.
    expect(error.describe()).toMatch(/permission|reach/i);
  });

  it('classifies a slow response as a timeout', async () => {
    const hang = new RedmineClient(
      { host: 'https://redmine.test', apiKey: 'k' },
      {
        timeoutMs: 10,
        fetch: ((_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })) as unknown as typeof globalThis.fetch,
      },
    );
    await expect(hang.get('/issues.json')).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('marks transient failures retryable and permanent ones not', () => {
    expect(new RedmineError('network', '').retryable).toBe(true);
    expect(new RedmineError('server', '').retryable).toBe(true);
    expect(new RedmineError('unauthorized', '').retryable).toBe(false);
    expect(new RedmineError('validation', '').retryable).toBe(false);
  });
});

describe('empty responses', () => {
  it('treats 204 as success with no body', async () => {
    const { instance } = client([{ status: 204, text: '' }]);
    await expect(instance.put('/issues/1.json', {})).resolves.toBeUndefined();
  });

  it('treats a blank 200 body as success', async () => {
    const { instance } = client([{ status: 200, text: '   ' }]);
    await expect(instance.put('/issues/1.json', {})).resolves.toBeUndefined();
  });
});

describe('pagination', () => {
  const page = (issues: unknown[], total: number, offset = 0) => ({
    body: { issues, total_count: total, offset, limit: MAX_PAGE_SIZE },
  });

  it('walks every page', async () => {
    const { instance, calls } = client([
      page([{ id: 1 }, { id: 2 }], 5),
      page([{ id: 3 }, { id: 4 }], 5, 2),
      page([{ id: 5 }], 5, 4),
    ]);

    const all = await instance.collect<{ id: number }>('/issues.json', 'issues', {}, { pageSize: 2 });
    expect(all.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toHaveLength(3);
    expect(new URL(calls[1]!.url).searchParams.get('offset')).toBe('2');
  });

  it('stops on an empty page even if total_count is stale', async () => {
    // Guards against the unbounded recursion v1's offset-bumping callbacks could hit.
    const { instance, calls } = client([page([{ id: 1 }], 999), page([], 999, 1)]);
    const all = await instance.collect('/issues.json', 'issues', {}, { pageSize: 1 });

    expect(all).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it('honours maxItems and stops fetching', async () => {
    const { instance, calls } = client([page([{ id: 1 }, { id: 2 }], 100)]);
    const all = await instance.collect('/issues.json', 'issues', {}, { pageSize: 2, maxItems: 2 });

    expect(all).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });

  it('caps page size at Redmine\'s server-side maximum', async () => {
    const { instance, calls } = client([page([], 0)]);
    await instance.collect('/issues.json', 'issues', {}, { pageSize: 500 });
    expect(new URL(calls[0]!.url).searchParams.get('limit')).toBe(String(MAX_PAGE_SIZE));
  });

  it('handles a single unpaginated page', async () => {
    const { instance } = client([{ body: { issues: [{ id: 1 }] } }]);
    const all = await instance.collect('/issues.json', 'issues');
    expect(all).toHaveLength(1);
  });
});
