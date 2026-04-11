import React, { useEffect, useState } from "react";
import { getSiteStats, SiteStatsData } from "../../api/getSiteStats";

export default function SiteStatsSummary(props: {
  className?: string;
  fallback?: SiteStatsData;
}) {
  const [stats, setStats] = useState<SiteStatsData | null>(null);

  useEffect(() => {
    let active = true;

    void getSiteStats()
      .then((data) => {
        if (active) {
          setStats(data);
        }
      })
      .catch(() => {
        if (active && props.fallback) {
          setStats(props.fallback);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const text = stats
    ? `${stats.categoryNum} 分类 × ${stats.postNum} 文章 × ${stats.tagNum} 标签 × ${stats.totalWordCount} 字`
    : "-- 分类 × -- 文章 × -- 标签 × -- 字";

  return <div className={props.className}>{text}</div>;
}
