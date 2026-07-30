const diagramCache = new Map<string, { data: string; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function getCacheKey(
  type: string,
  source: string,
  themeMode: string,
): string {
  return `${type}_${themeMode}_${simpleHash(source)}`;
}

export function getCachedDiagram(
  type: string,
  source: string,
  themeMode: string,
): string | null {
  const key = getCacheKey(type, source, themeMode);
  const cached = diagramCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  if (cached) {
    diagramCache.delete(key);
  }
  return null;
}

export function setCachedDiagram(
  type: string,
  source: string,
  themeMode: string,
  svg: string,
): void {
  const key = getCacheKey(type, source, themeMode);
  diagramCache.set(key, { data: svg, timestamp: Date.now() });
  if (diagramCache.size > 200) {
    const entries = Array.from(diagramCache.entries());
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 50)
      .forEach(([k]) => diagramCache.delete(k));
  }
}
