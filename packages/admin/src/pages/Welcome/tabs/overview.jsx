import NumSelect from '@/components/NumSelect';
import { getWelcomeData } from '@/services/van-blog/api';
import { useNum } from '@/services/van-blog/useNum';
import { Area, Line } from '@ant-design/plots';
import { Empty, Progress, Segmented, Spin } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  EyeOutlined,
  FileTextOutlined,
  HeartOutlined,
  TrophyOutlined,
  UserOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import style from '../index.less';
import {
  WELCOME_CHART_COLORS,
  getWelcomeAreaFill,
  getWelcomeAxisStyle,
  useWelcomeThemePalette,
} from '../theme';

const OverView = ({ compact = false }) => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useNum(5);
  const [trendMode, setTrendMode] = useState('visited');
  const [totalTrendMode, setTotalTrendMode] = useState('totalVisited');
  const palette = useWelcomeThemePalette();

  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('overview', num);
    setData(res);
  }, [num]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => {
      setLoading(false);
    });
  }, [fetchData]);

  const eachData = useMemo(
    () =>
      (data?.viewer?.grid?.each || []).map((item) => ({
        date: item.date,
        访客数: item.visited,
        访问量: item.viewer,
      })),
    [data],
  );

  const totalData = useMemo(
    () =>
      (data?.viewer?.grid?.total || []).map((item) => ({
        date: item.date,
        访客数: item.visited,
        访问量: item.viewer,
      })),
    [data],
  );

  const interestingMetrics = useMemo(() => {
    if (!data) return null;

    const articleNum = data?.total?.articleNum || 0;
    const wordCount = data?.total?.wordCount || 0;
    const totalViewer = data?.viewer?.now?.viewer || 0;
    const totalVisited = data?.viewer?.now?.visited || 0;
    const todayViewer = data?.viewer?.add?.viewer || 0;
    const todayVisited = data?.viewer?.add?.visited || 0;

    return {
      avgWordsPerArticle: articleNum > 0 ? Math.round(wordCount / articleNum) : 0,
      avgViewerPerArticle: articleNum > 0 ? Math.round(totalViewer / articleNum) : 0,
      retentionRate: totalViewer > 0 ? Math.round((totalVisited / totalViewer) * 100) : 0,
      todayGrowthRate: totalViewer > 0 ? Math.round((todayViewer / totalViewer) * 10000) / 100 : 0,
      productivityScore: Math.min(100, Math.round((articleNum * 2 + wordCount / 1000) / 10)),
      engagementScore: Math.min(100, Math.round((totalViewer + totalVisited * 2) / 100)),
    };
  }, [data]);

  const buildLineConfig = useCallback(
    ({ chartData, yField, colorPair, useArea = false }) => ({
      data: chartData,
      xField: 'date',
      yField,
      height: compact ? 190 : 220,
      smooth: true,
      color: colorPair[0],
      point: {
        size: compact ? 3 : 4,
        color: colorPair[0],
      },
      xAxis: {
        ...getWelcomeAxisStyle(palette),
        label: {
          ...getWelcomeAxisStyle(palette).label,
          autoHide: true,
          autoRotate: false,
        },
      },
      yAxis: getWelcomeAxisStyle(palette, true),
      area: useArea
        ? {
            style: {
              fill: getWelcomeAreaFill(colorPair[0], colorPair[1], palette),
              fillOpacity: palette.isDark ? 0.2 : 0.3,
            },
          }
        : undefined,
    }),
    [compact, palette],
  );

  const visitorTrendConfig = useMemo(
    () =>
      buildLineConfig({
        chartData: eachData,
        yField: '访客数',
        colorPair: WELCOME_CHART_COLORS.accent,
        useArea: true,
      }),
    [buildLineConfig, eachData],
  );

  const viewerTrendConfig = useMemo(
    () =>
      buildLineConfig({
        chartData: eachData,
        yField: '访问量',
        colorPair: WELCOME_CHART_COLORS.primary,
      }),
    [buildLineConfig, eachData],
  );

  const totalVisitedConfig = useMemo(
    () =>
      buildLineConfig({
        chartData: totalData,
        yField: '访客数',
        colorPair: WELCOME_CHART_COLORS.success,
        useArea: true,
      }),
    [buildLineConfig, totalData],
  );

  const totalViewerConfig = useMemo(
    () =>
      buildLineConfig({
        chartData: totalData,
        yField: '访问量',
        colorPair: WELCOME_CHART_COLORS.primary,
      }),
    [buildLineConfig, totalData],
  );

  const hasDailyTrendData = eachData.length >= 2;
  const hasTotalTrendData = totalData.length >= 2;

  const kpiItems = [
    {
      icon: <FileTextOutlined />,
      value: data?.total?.articleNum || 0,
      label: '文章总数',
      trend: `平均 ${interestingMetrics?.avgWordsPerArticle || 0} 字/篇`,
    },
    {
      icon: <EditOutlined />,
      value: data?.total?.wordCount || 0,
      label: '总字数',
      trend: `约 ${Math.round((data?.total?.wordCount || 0) / 500)} 页书`,
    },
    {
      icon: <UserOutlined />,
      value: data?.viewer?.now?.visited || 0,
      label: '总访客数',
      trend: `回访率 ${interestingMetrics?.retentionRate || 0}%`,
    },
    {
      icon: <EyeOutlined />,
      value: data?.viewer?.now?.viewer || 0,
      label: '总访问数',
      trend: `今日增长 ${interestingMetrics?.todayGrowthRate || 0}%`,
    },
  ];

  const todayMetrics = [
    {
      label: '今日新增访客',
      value: data?.viewer?.add?.visited || 0,
      helper: '近一天新增独立访客',
      percent: Math.min(100, (data?.viewer?.add?.visited || 0) * 2),
      strokeColor: WELCOME_CHART_COLORS.primary[0],
    },
    {
      label: '今日新增访问',
      value: data?.viewer?.add?.viewer || 0,
      helper: '近一天新增访问次数',
      percent: Math.min(100, (data?.viewer?.add?.viewer || 0) * 1.5),
      strokeColor: WELCOME_CHART_COLORS.accent[0],
    },
    {
      label: '平均文章热度',
      value: interestingMetrics?.avgViewerPerArticle || 0,
      helper: '单篇文章平均访问量',
      percent: Math.min(100, (interestingMetrics?.avgViewerPerArticle || 0) / 2),
      strokeColor: WELCOME_CHART_COLORS.cyan[0],
    },
  ];

  const scoreCards = [
    {
      label: '创作评分',
      value: interestingMetrics?.productivityScore || 0,
      note: '基于文章数量与总字数综合计算。',
      strokeColor: WELCOME_CHART_COLORS.success[0],
    },
    {
      label: '受欢迎度',
      value: interestingMetrics?.engagementScore || 0,
      note: '基于访问量与访客量衡量内容吸引力。',
      strokeColor: WELCOME_CHART_COLORS.accent[0],
    },
  ];

  const renderEmptyChart = (description, compactHeight = false) => (
    <div className={`${style['chart-empty']} ${compactHeight ? style['compact-empty'] : ''}`}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );

  const renderPanel = ({ title, icon, extra, children, note }) => (
    <section className={style['chart-container']}>
      <div className={style['chart-header']}>
        <div className={style['chart-title']}>
          {icon}
          <span>{title}</span>
        </div>
        {extra ? <div className={style['chart-extra']}>{extra}</div> : null}
      </div>
      {children}
      {note ? <div className={style['section-note']}>{note}</div> : null}
    </section>
  );

  const renderMetricList = (items) => (
    <div className={style['metric-list']}>
      {items.map((item) => (
        <div key={item.label}>
          <div className={style['metric-row-head']}>
            <span className={style['metric-label']}>{item.label}</span>
            <span className={style['metric-value']}>{item.value}</span>
          </div>
          {item.helper ? <div className={style['metric-helper']}>{item.helper}</div> : null}
          <Progress
            percent={Math.max(0, Math.min(100, item.percent || 0))}
            strokeColor={item.strokeColor}
            trailColor={palette.progressTrail}
            size="small"
            className={style['metric-progress']}
            showInfo={false}
          />
        </div>
      ))}
    </div>
  );

  const dailyViews = {
    visited: {
      title: '访客数趋势',
      node: hasDailyTrendData ? (
        <Area {...visitorTrendConfig} />
      ) : (
        renderEmptyChart('至少需要 2 天访客数据', true)
      ),
    },
    viewer: {
      title: '访问量趋势',
      node: hasDailyTrendData ? (
        <Line {...viewerTrendConfig} />
      ) : (
        renderEmptyChart('至少需要 2 天访问数据', true)
      ),
    },
  };

  const totalViews = {
    totalVisited: {
      title: '累计访客',
      node: hasTotalTrendData ? (
        <Area {...totalVisitedConfig} />
      ) : (
        renderEmptyChart('至少需要 2 天累计访客数据', true)
      ),
    },
    totalViewer: {
      title: '累计访问',
      node: hasTotalTrendData ? (
        <Line {...totalViewerConfig} />
      ) : (
        renderEmptyChart('至少需要 2 天累计访问数据', true)
      ),
    },
  };

  return (
    <div className={style['welcome-tab-panel']}>
      <Spin spinning={loading}>
        <div className={style['section-stack']}>
          <section className={style['kpi-grid']}>
            {kpiItems.map((item) => (
              <div key={item.label} className={style['stat-card']}>
                <div className={style['stat-icon']}>{item.icon}</div>
                <div className={style['stat-number']}>{item.value}</div>
                <div className={style['stat-label']}>{item.label}</div>
                <div className={style['stat-trend']}>{item.trend}</div>
              </div>
            ))}
          </section>

          {compact ? (
            <>
              {renderPanel({
                title: '今日表现',
                icon: <CalendarOutlined className={style['chart-icon']} />,
                children: renderMetricList(todayMetrics),
                note: '把今天的增长放在首屏，方便手机上快速扫读。',
              })}

              {renderPanel({
                title: dailyViews[trendMode].title,
                icon: <BarChartOutlined className={style['chart-icon']} />,
                extra: (
                  <>
                    <div className={style['chart-switch']}>
                      <Segmented
                        size="small"
                        value={trendMode}
                        onChange={setTrendMode}
                        options={[
                          { label: '访客', value: 'visited' },
                          { label: '访问', value: 'viewer' },
                        ]}
                      />
                    </div>
                    <NumSelect d="天" value={num} setValue={setNum} />
                  </>
                ),
                children: dailyViews[trendMode].node,
              })}

              {renderPanel({
                title: totalViews[totalTrendMode].title,
                icon: <BarChartOutlined className={style['chart-icon']} />,
                extra: (
                  <>
                    <div className={style['chart-switch']}>
                      <Segmented
                        size="small"
                        value={totalTrendMode}
                        onChange={setTotalTrendMode}
                        options={[
                          { label: '累计访客', value: 'totalVisited' },
                          { label: '累计访问', value: 'totalViewer' },
                        ]}
                      />
                    </div>
                    <NumSelect d="天" value={num} setValue={setNum} />
                  </>
                ),
                children: totalViews[totalTrendMode].node,
              })}

              <div className={style['compact-summary-grid']}>
                {scoreCards.map((item) => (
                  <div key={item.label} className={style['score-summary-card']}>
                    <div className={style['score-summary-label']}>{item.label}</div>
                    <div className={style['score-summary-value']}>{item.value}分</div>
                    <Progress
                      percent={item.value}
                      strokeColor={item.strokeColor}
                      trailColor={palette.progressTrail}
                      size="small"
                      showInfo={false}
                      className={style['metric-progress']}
                    />
                    <div className={style['score-summary-note']}>{item.note}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className={style['section-grid-2']}>
                {renderPanel({
                  title: '访客数趋势',
                  icon: <BarChartOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="天" value={num} setValue={setNum} />,
                  children: hasDailyTrendData ? (
                    <Area {...visitorTrendConfig} />
                  ) : (
                    renderEmptyChart('访客趋势数据不足，至少需要 2 天数据')
                  ),
                })}
                {renderPanel({
                  title: '访问量趋势',
                  icon: <BarChartOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="天" value={num} setValue={setNum} />,
                  children: hasDailyTrendData ? (
                    <Line {...viewerTrendConfig} />
                  ) : (
                    renderEmptyChart('访问趋势数据不足，至少需要 2 天数据')
                  ),
                })}
              </div>

              <div className={style['section-grid-3']}>
                {renderPanel({
                  title: '创作力评估',
                  icon: <TrophyOutlined className={style['chart-icon']} />,
                  children: (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
                      <Progress
                        type="dashboard"
                        percent={Math.max(
                          0,
                          Math.min(100, interestingMetrics?.productivityScore || 0),
                        )}
                        strokeColor={WELCOME_CHART_COLORS.success[0]}
                        trailColor={palette.progressTrail}
                        format={() => (
                          <span style={{ color: palette.textPrimary }}>
                            {interestingMetrics?.productivityScore || 0}分
                          </span>
                        )}
                      />
                    </div>
                  ),
                  note: '基于文章数量和字数综合评估。',
                })}
                {renderPanel({
                  title: '受欢迎程度',
                  icon: <HeartOutlined className={style['chart-icon']} />,
                  children: (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
                      <Progress
                        type="dashboard"
                        percent={Math.max(
                          0,
                          Math.min(100, interestingMetrics?.engagementScore || 0),
                        )}
                        strokeColor={WELCOME_CHART_COLORS.accent[0]}
                        trailColor={palette.progressTrail}
                        format={() => (
                          <span style={{ color: palette.textPrimary }}>
                            {interestingMetrics?.engagementScore || 0}分
                          </span>
                        )}
                      />
                    </div>
                  ),
                  note: '基于访问量和访客数综合评估。',
                })}
                {renderPanel({
                  title: '今日表现',
                  icon: <CalendarOutlined className={style['chart-icon']} />,
                  children: renderMetricList(todayMetrics),
                })}
              </div>

              <div className={style['section-grid-2']}>
                {renderPanel({
                  title: '累计访客数趋势',
                  icon: <BarChartOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="天" value={num} setValue={setNum} />,
                  children: hasTotalTrendData ? (
                    <Area {...totalVisitedConfig} />
                  ) : (
                    renderEmptyChart('累计访客趋势数据不足，至少需要 2 天数据')
                  ),
                })}
                {renderPanel({
                  title: '累计访问量趋势',
                  icon: <BarChartOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="天" value={num} setValue={setNum} />,
                  children: hasTotalTrendData ? (
                    <Line {...totalViewerConfig} />
                  ) : (
                    renderEmptyChart('累计访问趋势数据不足，至少需要 2 天数据')
                  ),
                })}
              </div>
            </>
          )}
        </div>
      </Spin>
    </div>
  );
};

export default OverView;
