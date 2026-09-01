import type { RedmineClient } from './client';
import type { User } from './types';

export async function getCurrentUser(client: RedmineClient, signal?: AbortSignal): Promise<User> {
  const body = await client.get<{ user: User }>('/users/current.json', {}, signal);
  return body.user;
}

/** Requires admin rights; callers must tolerate a 403. */
export function listUsers(
  client: RedmineClient,
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<User[]> {
  return client.collect<User>('/users.json', 'users', { status: 1 }, options);
}

export function displayName(user: Pick<User, 'firstname' | 'lastname'>): string {
  return `${user.firstname} ${user.lastname}`.trim();
}
