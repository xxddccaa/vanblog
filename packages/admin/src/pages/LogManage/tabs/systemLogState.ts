export type SystemLogBatch = {
  data?: string[];
  nextCursor?: string | null;
  reset?: boolean;
};

export function mergeSystemLogLines(
  current: string[],
  batch: SystemLogBatch,
  limit = 1000,
) {
  const incoming = Array.isArray(batch.data) ? batch.data : [];
  const next = batch.reset ? incoming : [...current, ...incoming];
  return next.slice(-Math.max(1, limit));
}
