import { describe, expect, it, vi } from 'vitest';

import { testConnection } from './connection';

const BASE = { host: 'https://redmine.test', apiKey: 'key' };

function withFetch(handler: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async () => handler()));
}

describe('testConnection', () => {
  it('succeeds and reports who you are', async () => {
    withFetch(() => new Response(JSON.stringify({ user: { id: 3, firstname: 'A', lastname: 'B' } })));

    const result = await testConnection(BASE);
    expect(result).toMatchObject({ ok: true, host: 'https://redmine.test' });
  });

  it('rejects an unparseable host before making a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await testConnection({ ...BASE, host: 'ht!tp://%%%' });
    expect(result).toMatchObject({ ok: false, kind: 'invalid-host' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports a missing key without making a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await testConnection({ ...BASE, apiKey: '  ' })).toMatchObject({ ok: false, kind: 'no-key' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('distinguishes a missing host permission from being offline', async () => {
    const result = await testConnection(BASE, { hasPermission: async () => false });
    expect(result).toMatchObject({ ok: false, kind: 'no-permission' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hint).toMatch(/CORS/);
  });

  it('maps 401 to a rejected key', async () => {
    withFetch(() => new Response('{}', { status: 401 }));
    expect(await testConnection(BASE)).toMatchObject({ ok: false, kind: 'unauthorized' });
  });

  it('maps 403 to the REST API being disabled', async () => {
    withFetch(() => new Response('{}', { status: 403 }));

    const result = await testConnection(BASE);
    expect(result).toMatchObject({ ok: false, kind: 'api-disabled' });
    if (!result.ok) expect(result.hint).toMatch(/Administration/);
  });

  it('maps 404 to "not a Redmine root"', async () => {
    withFetch(() => new Response('{}', { status: 404 }));
    expect(await testConnection(BASE)).toMatchObject({ ok: false, kind: 'not-redmine' });
  });

  it('maps an HTML body to "not a Redmine root"', async () => {
    withFetch(() => new Response('<html>login</html>', { status: 200 }));
    expect(await testConnection(BASE)).toMatchObject({ ok: false, kind: 'not-redmine' });
  });

  it('maps a rejected fetch to unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await testConnection(BASE)).toMatchObject({ ok: false, kind: 'unreachable' });
  });
});
