import { RedmineClient } from '@/lib/redmine';
import { prefs, secrets } from '@/lib/store/app.svelte';

/**
 * A client built from current settings, or null when not configured yet.
 *
 * The UI talks to Redmine directly for user-initiated actions; the service
 * worker owns only background polling. Both import the same client module, so
 * there is one place that knows how to call Redmine.
 */
export function currentClient(): RedmineClient | null {
  const host = prefs.current.host;
  const apiKey = secrets.current.apiKey;
  if (!host || !apiKey) return null;

  try {
    return new RedmineClient({
      host,
      apiKey,
      useHttpAuth: prefs.current.useHttpAuth,
      httpUser: prefs.current.httpUser,
      httpPassword: secrets.current.httpPassword,
    });
  } catch {
    return null;
  }
}
