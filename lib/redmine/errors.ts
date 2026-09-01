/**
 * Error taxonomy for Redmine API calls.
 *
 * v1 threw `{error, request}` blobs and re-parsed `error.request.response` at
 * three separate call sites to find validation messages. Everything the UI
 * needs to react to is modelled here instead, so callers switch on `kind`
 * rather than sniffing status codes.
 */

export type RedmineErrorKind =
  /** Host permission for the Redmine origin has not been granted. */
  | 'permission'
  /** 401 — API key rejected. */
  | 'unauthorized'
  /** 403 — REST API disabled server-side, or the user lacks rights. */
  | 'forbidden'
  /** 404 — no such resource, or the host is not a Redmine root. */
  | 'not_found'
  /** 422 — Redmine rejected the payload; see `errors`. */
  | 'validation'
  /** 429 — throttled. */
  | 'rate_limited'
  /** 5xx. */
  | 'server'
  /** fetch() rejected: DNS failure, refused connection, blocked by CORS. */
  | 'network'
  /** Request exceeded the client timeout. */
  | 'timeout'
  /** Response was not JSON — usually an HTML login or error page. */
  | 'parse'
  /** Request was cancelled by the caller. */
  | 'aborted';

export class RedmineError extends Error {
  readonly kind: RedmineErrorKind;
  readonly status: number | undefined;
  /** Validation messages from a 422 response. Empty for every other kind. */
  readonly errors: readonly string[];
  readonly url: string | undefined;

  constructor(
    kind: RedmineErrorKind,
    message: string,
    options: {
      status?: number;
      errors?: readonly string[];
      url?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'RedmineError';
    this.kind = kind;
    this.status = options.status;
    this.errors = options.errors ?? [];
    this.url = options.url;
  }

  /**
   * A message worth showing a user, phrased around what they can do about it.
   *
   * The `permission` and `forbidden` cases matter most: they are the two
   * failures that look identical from the outside ("nothing loads") but have
   * completely different fixes.
   */
  describe(): string {
    switch (this.kind) {
      case 'permission':
        return 'This extension has no permission to reach that Redmine host. Open Options and grant access.';
      case 'unauthorized':
        return 'Redmine rejected the API key. Check it in Options — you can copy a fresh one from your Redmine account page.';
      case 'forbidden':
        return "Redmine refused the request. The REST API is most likely disabled — an administrator can enable it under Administration → Settings → API.";
      case 'not_found':
        return 'Not found. If nothing at all loads, the host may not be the root URL of a Redmine instance.';
      case 'validation':
        return this.errors.length > 0
          ? this.errors.join('\n')
          : 'Redmine rejected the change.';
      case 'rate_limited':
        return 'Redmine is rate limiting this extension. It will retry shortly.';
      case 'server':
        return `Redmine returned a server error${this.status ? ` (${this.status})` : ''}. Try again in a moment.`;
      case 'network':
        return 'Could not reach Redmine. Check the host in Options and that you are online.';
      case 'timeout':
        return 'Redmine took too long to respond.';
      case 'parse':
        return "Redmine's response was not valid JSON. The host may be pointing at a login page rather than the API.";
      case 'aborted':
        return 'Request cancelled.';
    }
  }

  /** True when retrying the identical request could plausibly succeed. */
  get retryable(): boolean {
    return (
      this.kind === 'network' ||
      this.kind === 'timeout' ||
      this.kind === 'server' ||
      this.kind === 'rate_limited'
    );
  }
}

/** Narrowing helper for `catch` blocks. */
export function isRedmineError(err: unknown): err is RedmineError {
  return err instanceof RedmineError;
}
