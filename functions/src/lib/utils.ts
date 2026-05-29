import { Timestamp } from 'firebase-admin/firestore';

export const normaliseSlug = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const isCacheStale = (cachedAt: Timestamp): boolean => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - cachedAt.toMillis() > SEVEN_DAYS_MS;
};

export const selectUrls = (urls: Array<{ label: string; url: string }>, max = 2): string[] => {
  const priority = ['linkedin', 'github'];
  const sorted = [...urls].sort((a, b) => {
    const ai = priority.findIndex(p => a.label.toLowerCase().includes(p));
    const bi = priority.findIndex(p => b.label.toLowerCase().includes(p));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted.slice(0, max).map(u => u.url);
};
