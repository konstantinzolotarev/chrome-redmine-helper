import type { RedmineClient } from './client';
import type { NewsItem } from './types';

export function listNews(
  client: RedmineClient,
  projectId?: number | string,
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<NewsItem[]> {
  const path = projectId ? `/projects/${projectId}/news.json` : '/news.json';
  return client.collect<NewsItem>(path, 'news', {}, options);
}
