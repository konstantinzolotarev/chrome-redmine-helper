import { RedmineClient, normalizeHost, originPattern } from './client';
import { isRedmineError } from './errors';
import type { User } from './types';
import { getCurrentUser } from './users';

export type ConnectionResult =
  | { ok: true; user: User; host: string }
  | { ok: false; kind: ConnectionFailure; message: string; hint?: string };

export type ConnectionFailure =
  | 'invalid-host'
  | 'no-key'
  | 'no-permission'
  | 'unauthorized'
  | 'api-disabled'
  | 'not-redmine'
  | 'unreachable'
  | 'unknown';

export interface ConnectionInput {
  host: string;
  apiKey: string;
  useHttpAuth?: boolean;
  httpUser?: string;
  httpPassword?: string;
}

/**
 * Check a connection and say something actionable about why it failed.
 *
 * v1 surfaced every failure as the same `Err` badge and a "Server is not
 * accessible" banner, which conflates a wrong key, a disabled REST API, a
 * missing host permission and being offline — four problems with four different
 * fixes.
 */
export async function testConnection(
  input: ConnectionInput,
  options: {
    hasPermission?: (origin: string) => Promise<boolean>;
    timeoutMs?: number;
  } = {},
): Promise<ConnectionResult> {
  let host: string;
  try {
    host = normalizeHost(input.host);
  } catch (error) {
    return {
      ok: false,
      kind: 'invalid-host',
      message: isRedmineError(error) ? error.message : 'That host is not a valid URL.',
      hint: 'Use the root URL of your Redmine, for example https://redmine.example.com',
    };
  }

  if (!input.apiKey.trim()) {
    return {
      ok: false,
      kind: 'no-key',
      message: 'No API key set.',
      hint: 'Find it on your Redmine account page, usually in the right-hand column.',
    };
  }

  if (options.hasPermission) {
    const granted = await options.hasPermission(originPattern(host));
    if (!granted) {
      return {
        ok: false,
        kind: 'no-permission',
        message: 'This extension has not been granted access to that host.',
        hint: 'Redmine sends no CORS headers, so the browser blocks requests to origins the extension has no permission for.',
      };
    }
  }

  const client = new RedmineClient(
    {
      host,
      apiKey: input.apiKey,
      useHttpAuth: input.useHttpAuth,
      httpUser: input.httpUser,
      httpPassword: input.httpPassword,
    },
    { timeoutMs: options.timeoutMs ?? 10_000 },
  );

  try {
    const user = await getCurrentUser(client);
    return { ok: true, user, host };
  } catch (error) {
    if (!isRedmineError(error)) {
      return { ok: false, kind: 'unknown', message: String(error) };
    }

    switch (error.kind) {
      case 'unauthorized':
        return {
          ok: false,
          kind: 'unauthorized',
          message: 'Redmine rejected the API key.',
          hint: 'Copy a fresh key from your Redmine account page.',
        };
      case 'forbidden':
        return {
          ok: false,
          kind: 'api-disabled',
          message: 'Redmine refused the request.',
          hint: 'The REST API is most likely switched off — an administrator can enable it under Administration → Settings → API.',
        };
      case 'not_found':
      case 'parse':
        return {
          ok: false,
          kind: 'not-redmine',
          message: 'That URL did not answer like a Redmine instance.',
          hint: 'Point at the root of Redmine, not a sub-page or a login URL.',
        };
      case 'timeout':
      case 'network':
        return {
          ok: false,
          kind: 'unreachable',
          message: error.describe(),
          hint: 'Check the host is reachable from this browser.',
        };
      default:
        return { ok: false, kind: 'unknown', message: error.describe() };
    }
  }
}
