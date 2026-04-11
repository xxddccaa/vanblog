export const toCacheTag = (prefix: string, value?: string | number | null) => {
  if (value === undefined || value === null || value === '') {
    return prefix;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${prefix}:${normalized || 'unknown'}`;
};

export const formatCacheTags = (tags: Array<string | null | undefined>) =>
  [...new Set(tags.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean))].join(',');
