export interface SiteStatsData {
  postNum: number;
  tagNum: number;
  categoryNum: number;
  totalWordCount: number;
}

export const getSiteStats = async (): Promise<SiteStatsData> => {
  const res = await fetch('/api/public/site-stats');
  const { statusCode, data } = await res.json();
  if (statusCode !== 200 || !data) {
    throw new Error('Failed to load site stats');
  }
  return data;
};
