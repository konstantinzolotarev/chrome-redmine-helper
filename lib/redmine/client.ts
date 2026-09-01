import { RedmineError } from './errors';
import type { PagedResponse } from './types';

export interface RedmineCredentials {
  host: string;
  apiKey: string;
  /** For Redmine behind a reverse proxy that also demands HTTP Basic auth. */
  useHttpAuth?: boolean;
  httpUser?: string;
  httpPassword?: string;
}

export interface RedmineClientOptions {
  timeoutMs?: number;
  /** Injectable for tests. */
  fetch?: typeof globalThis.fetch;
}

type QueryValue = string | number | boolean | null | undefined | Array<string | number>;
export type QueryParams = Record<string, QueryValue>;

const DEFAULT_TIMEOUT_MS = 20_000;

/** Redmine caps `limit` at 100 regardless of what you ask for. */
export const MAX_PAGE_SIZE = 100;

/**
 * Accept what users actually type ("redmine.example.com", with or without a
 * trailing slash) and produce a canonical origin+path prefix with no trailing
 * slash. v1 only appended a missing slash and left everything else alone.
 */
/** A DNS name, an IPv4 literal, or a bracketed IPv6 literal. */
const VALID_HOSTNAME = /^(?:[a-z0-9._-]+|\[[0-9a-f:.]+\])$/i;

export function normalizeHost(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new RedmineError('network', 'No Redmine host configured.');
  }

  // Reject a non-http(s) scheme rather than silently prefixing `https://` and
  // producing something that can never resolve.
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);
  if (scheme && !/^https?$/i.test(scheme[1]!)) {
    throw new RedmineError('network', `Redmine must be reached over http or https, not ${scheme[1]}.`);
  }

  const withScheme = scheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch (cause) {
    throw new RedmineError('network', `"${raw}" is not a valid URL.`, { cause });
  }

  // URL parsing alone is not enough of a check: the WHATWG parser happily
  // accepts hostnames like `ht!tp` that no resolver will ever answer for, so a
  // typo would surface much later as an opaque network failure.
  if (!VALID_HOSTNAME.test(url.hostname)) {
    throw new RedmineError('network', `"${raw}" is not a valid Redmine host.`);
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** The match pattern to hand to `chrome.permissions.request()` for a host. */
export function originPattern(host: string): string {
  return `${new URL(normalizeHost(host)).origin}/*`;
}

/** btoa() throws on non-Latin1; encode as UTF-8 first so unicode passwords work. */
function base64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      // Repeated keys, the Rails convention Redmine's query filters rely on
      // (`f[]=a&f[]=b`, `v[project_id][]=1&v[project_id][]=2`).
      //
      // NOT pipe-joined: `project_id=1|2` is a 404 on Redmine, because that
      // parameter is read as a single project id or identifier.
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export class RedmineClient {
  readonly host: string;
  private readonly credentials: RedmineCredentials;
  private readonly timeoutMs: number;
  private readonly doFetch: typeof globalThis.fetch;

  constructor(credentials: RedmineCredentials, options: RedmineClientOptions = {}) {
    this.credentials = credentials;
    this.host = normalizeHost(credentials.host);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private headers(contentType?: string): Headers {
    const headers = new Headers({ Accept: 'application/json' });

    if (this.credentials.apiKey) {
      // Header rather than a `key=` query param: query strings end up in server
      // access logs, and the key is a full-privilege credential.
      headers.set('X-Redmine-API-Key', this.credentials.apiKey);
    }

    if (this.credentials.useHttpAuth && this.credentials.httpUser) {
      const pair = `${this.credentials.httpUser}:${this.credentials.httpPassword ?? ''}`;
      headers.set('Authorization', `Basic ${base64(pair)}`);
    }

    if (contentType) headers.set('Content-Type', contentType);
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    init: { params?: QueryParams; body?: BodyInit; contentType?: string; signal?: AbortSignal } = {},
  ): Promise<T> {
    const url = `${this.host}${path}${buildQuery(init.params ?? {})}`;

    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await this.doFetch(url, {
        method,
        headers: this.headers(init.contentType),
        body: init.body,
        signal,
        // The API key is the credential; never attach ambient Redmine cookies.
        credentials: 'omit',
        redirect: 'follow',
      });
    } catch (cause) {
      if (timeout.aborted) {
        throw new RedmineError('timeout', `Timed out after ${this.timeoutMs}ms.`, { url, cause });
      }
      if (init.signal?.aborted) {
        throw new RedmineError('aborted', 'Request cancelled.', { url, cause });
      }
      // fetch() rejects for DNS failure, refused connections, and — the case
      // that actually bites here — a missing host permission, which surfaces as
      // an opaque CORS failure indistinguishable from being offline.
      throw new RedmineError(
        'network',
        'Could not reach Redmine. If the host is correct, the extension may be missing permission for this origin.',
        { url, cause },
      );
    }

    if (!response.ok) throw await this.toError(response, url);

    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return undefined as T;
    }

    const text = await response.text();
    if (text.trim() === '') return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new RedmineError('parse', 'Redmine did not return JSON.', {
        status: response.status,
        url,
        cause,
      });
    }
  }

  private async toError(response: Response, url: string): Promise<RedmineError> {
    const base = { status: response.status, url };

    switch (response.status) {
      case 401:
        return new RedmineError('unauthorized', 'Redmine rejected the API key.', base);
      case 403:
        return new RedmineError('forbidden', 'Redmine refused the request.', base);
      case 404:
        return new RedmineError('not_found', 'Not found.', base);
      case 429:
        return new RedmineError('rate_limited', 'Too many requests.', base);
      case 422: {
        // Redmine returns {"errors": ["Subject can't be blank", ...]}.
        let errors: string[] = [];
        try {
          const body = JSON.parse(await response.text()) as { errors?: unknown };
          if (Array.isArray(body.errors)) errors = body.errors.map(String);
        } catch {
          // Body was not the documented shape; the generic message still applies.
        }
        return new RedmineError('validation', 'Redmine rejected the change.', { ...base, errors });
      }
      default:
        if (response.status >= 500) {
          return new RedmineError('server', `Redmine returned ${response.status}.`, base);
        }
        return new RedmineError('network', `Unexpected response ${response.status}.`, base);
    }
  }

  get<T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, { params, signal });
  }

  post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('POST', path, {
      body: JSON.stringify(body),
      contentType: 'application/json',
      signal,
    });
  }

  put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return this.request<T>('PUT', path, {
      body: JSON.stringify(body),
      contentType: 'application/json',
      signal,
    });
  }

  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', path, { signal });
  }

  /** Raw binary upload; Redmine answers with a token to attach to an issue. */
  uploadFile(body: Blob | ArrayBuffer, filename: string, signal?: AbortSignal) {
    return this.request<{ upload: { token: string; id?: number } }>('POST', '/uploads.json', {
      params: { filename },
      body: body as BodyInit,
      contentType: 'application/octet-stream',
      signal,
    });
  }

  /**
   * Walk a paginated collection page by page.
   *
   * Replaces v1's pattern of recursive callbacks that re-entered `load()` with a
   * bumped offset — which had no termination guard and could not be cancelled.
   */
  async *paginate<T>(
    path: string,
    key: string,
    params: QueryParams = {},
    options: { pageSize?: number; maxItems?: number; signal?: AbortSignal } = {},
  ): AsyncGenerator<T, void, void> {
    const limit = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
    const maxItems = options.maxItems ?? Infinity;

    let offset = 0;
    let yielded = 0;

    while (yielded < maxItems) {
      const page = await this.get<PagedResponse & Record<string, unknown>>(
        path,
        { ...params, limit, offset },
        options.signal,
      );

      const items = (page[key] ?? []) as T[];
      // An empty page terminates regardless of what total_count claims — without
      // this a server that reports a stale total loops forever.
      if (items.length === 0) return;

      for (const item of items) {
        yield item;
        if (++yielded >= maxItems) return;
      }

      offset += items.length;
      const total = page.total_count;
      if (typeof total !== 'number' || offset >= total) return;
    }
  }

  /** Collect a paginated collection into an array. */
  async collect<T>(
    path: string,
    key: string,
    params: QueryParams = {},
    options: { pageSize?: number; maxItems?: number; signal?: AbortSignal } = {},
  ): Promise<T[]> {
    const out: T[] = [];
    for await (const item of this.paginate<T>(path, key, params, options)) out.push(item);
    return out;
  }
}
