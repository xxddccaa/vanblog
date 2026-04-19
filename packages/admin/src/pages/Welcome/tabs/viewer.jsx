import { Spin, Card, Progress, Statistic, Tag, Empty, Segmented } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import style from '../index.less';
import NumSelect from '@/components/NumSelect';
import { useNum } from '@/services/van-blog/useNum';
import {
  UserOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  TrophyOutlined,
  FireOutlined,
  GlobalOutlined,
  RiseOutlined,
  TeamOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { Liquid, Column } from '@ant-design/plots';
import { WELCOME_CHART_COLORS, getWelcomeAxisStyle, useWelcomeThemePalette } from '../theme';

const Viewer = ({ compact = false }) => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useNum(5);
  const [rankMode, setRankMode] = useState('topViewer');
  const palette = useWelcomeThemePalette();

  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('viewer', 5, num);
    setData(res);
  }, [num]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => {
      setLoading(false);
    });
  }, [fetchData]);

  const recentHref = useMemo(() => {
    if (!data?.siteLastVisitedPathname) {
      return undefined;
    }
    return data.siteLastVisitedPathname;
  }, [data]);

  const recentVisitTime = useMemo(() => {
    if (!data?.siteLastVisitedTime) {
      return '-';
    }
    return getRecentTimeDes(data.siteLastVisitedTime);
  }, [data]);

  const formatPathLabel = useCallback((pathname) => {
    if (!pathname) {
      return '未知路径';
    }
    if (pathname === '/') {
      return '首页 /';
    }
    if (pathname.length <= 36) {
      return pathname;
    }
    return `${pathname.slice(0, 33)}...`;
  }, []);

  const visitorAnalytics = useMemo(() => {
    if (!data) return null;

    const totalVisited = data?.totalVisited || 0;
    const totalViewer = data?.totalViewer || 0;
    const maxArticleVisited = data?.maxArticleVisited || 0;
    const maxArticleViewer = data?.maxArticleViewer || 0;

    return {
      loyaltyRate: totalViewer > 0 ? Math.round((totalVisited / totalViewer) * 100) : 0,
      averageEngagement:
        totalVisited > 0 ? Math.round((totalViewer / totalVisited) * 100) / 100 : 0,
      peakPerformance: Math.max(maxArticleVisited, maxArticleViewer),
      visitorQuality:
        totalVisited > 0 ? Math.min(100, Math.round((totalViewer / totalVisited) * 20)) : 0,
    };
  }, [data]);

  const liquidConfig = useMemo(
    () => ({
      percent: visitorAnalytics?.loyaltyRate / 100 || 0,
      height: 220,
      shape: 'diamond',
      color: WELCOME_CHART_COLORS.primary,
      statistic: {
        title: {
          formatter: () => '访客忠诚度',
          style: {
            fontSize: '14px',
            color: palette.textSecondary,
          },
        },
        content: {
          style: {
            fontSize: '24px',
            fontWeight: 'bold',
            color: palette.statisticText,
          },
          formatter: () => `${visitorAnalytics?.loyaltyRate || 0}%`,
        },
      },
    }),
    [palette.statisticText, palette.textSecondary, visitorAnalytics?.loyaltyRate],
  );

  const topArticlesConfig = useMemo(
    () => ({
      data: (data?.topViewer || []).slice(0, 10).map((article) => ({
        title: article.title.length > 15 ? `${article.title.substring(0, 15)}...` : article.title,
        viewer: article.viewer,
        visited: article.visited,
      })),
      xField: 'title',
      yField: 'viewer',
      height: 320,
      color: WELCOME_CHART_COLORS.accent[0],
      columnStyle: {
        radius: [4, 4, 0, 0],
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
      meta: {
        title: { alias: '文章标题' },
        viewer: { alias: '访问量' },
      },
      label: {
        position: 'top',
        style: {
          fill: palette.chartLabel,
          fontSize: 12,
        },
      },
    }),
    [data?.topViewer, palette],
  );

  const getRankBadgeProps = useCallback(
    (index, gradient) => {
      if (index < 3) {
        return {
          className: `${style['rank-badge']} ${style['rank-badge-top']}`,
          style: { background: gradient },
        };
      }

      return {
        className: `${style['rank-badge']} ${style['rank-badge-neutral']}`,
        style: {
          background: palette.badgeNeutralBg,
          color: palette.badgeNeutralText,
        },
      };
    },
    [palette.badgeNeutralBg, palette.badgeNeutralText],
  );

  const kpiItems = [
    {
      icon: <TeamOutlined />,
      value: data?.totalVisited || 0,
      label: '总访客数',
      trend: `忠诚度 ${visitorAnalytics?.loyaltyRate || 0}%`,
    },
    {
      icon: <EyeOutlined />,
      value: data?.totalViewer || 0,
      label: '总访问数',
      trend: `平均互动 ${visitorAnalytics?.averageEngagement || 0} 次`,
    },
    {
      icon: <TrophyOutlined />,
      value: data?.maxArticleVisited || 0,
      label: '单篇最高访客',
      trend: '表现最好的内容峰值',
    },
    {
      icon: <FireOutlined />,
      value: data?.maxArticleViewer || 0,
      label: '单篇最高访问',
      trend: '爆款文章的最高热度',
    },
  ];

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

  const renderRankList = ({ items, gradient, emptyText, renderTitle, renderMeta }) => {
    if (!items.length) {
      return <div className={style['rank-list-empty']}>{renderEmptyChart(emptyText)}</div>;
    }

    return (
      <div className={style['article-list-modern']}>
        {items.map((item, index) => {
          const rankBadge = getRankBadgeProps(index, gradient);
          return (
            <div key={item.key} className={style['article-item']}>
              <div className={style['article-itemRow']}>
                <div {...rankBadge}>{index + 1}</div>
                <div className={style['article-itemBody']}>
                  <div className={style['article-title']}>{renderTitle(item)}</div>
                  <div className={style['article-meta']}>{renderMeta(item)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEmptyChart = (description) => (
    <div className={style['chart-empty']}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );

  const compactRankViews = {
    topViewer: {
      title: '热门文章',
      items: (data?.topViewer || []).slice(0, num).map((article) => ({
        key: `top-${article.id}`,
        title: article.title,
        meta: `${article.viewer} 次访问 · ${article.visited} 位访客`,
        href: `/post/${article.id}`,
      })),
      gradient: 'linear-gradient(45deg, #f093fb, #f5576c)',
    },
    recentVisit: {
      title: '最近访问',
      items: (data?.recentVisitArticles || []).slice(0, num).map((article) => ({
        key: `recent-${article.id}`,
        title: article.title,
        meta: getRecentTimeDes(article.lastVisitedTime),
        href: `/post/${article.id}`,
      })),
      gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
    },
    topPath: {
      title: '热门路径',
      items: (data?.topVisitedPaths || []).slice(0, num).map((item, index) => ({
        key: `path-${item.pathname}-${index}`,
        title: formatPathLabel(item.pathname),
        meta: `${item.viewer} 次访问 · ${item.visited} 位访客`,
        pathname: item.pathname,
      })),
      gradient: 'linear-gradient(45deg, #43e97b, #38f9d7)',
    },
    recentPath: {
      title: '最近活跃',
      items: (data?.recentVisitedPaths || []).slice(0, num).map((item, index) => ({
        key: `recent-path-${item.pathname}-${index}`,
        title: formatPathLabel(item.pathname),
        meta: item.lastVisitedTime ? getRecentTimeDes(item.lastVisitedTime) : '暂无访问时间',
        pathname: item.pathname,
      })),
      gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
    },
  };

  const compactRankView = compactRankViews[rankMode];

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
              <div className={style['section-grid-2']}>
                {renderPanel({
                  title: '访客忠诚度',
                  icon: <HeartOutlined className={style['chart-icon']} />,
                  children: (
                    <>
                      <div className={style['compact-value-hero']}>
                        <div className={style['compact-value-main']}>
                          {visitorAnalytics?.loyaltyRate || 0}%
                        </div>
                        <div className={style['compact-value-meta']}>回访用户占总访问的比例</div>
                      </div>
                      <Progress
                        percent={visitorAnalytics?.loyaltyRate || 0}
                        strokeColor={WELCOME_CHART_COLORS.primary[0]}
                        trailColor={palette.progressTrail}
                        showInfo={false}
                      />
                      <div className={style['compact-summary-grid']} style={{ marginTop: 16 }}>
                        <div className={style['compact-summary-card']}>
                          <div className={style['metric-label']}>访客质量</div>
                          <div className={style['score-summary-value']} style={{ fontSize: 24 }}>
                            {visitorAnalytics?.visitorQuality || 0}
                          </div>
                          <div className={style['metric-helper']}>按访问深度估算的质量分</div>
                        </div>
                        <div className={style['compact-summary-card']}>
                          <div className={style['metric-label']}>平均互动</div>
                          <div className={style['score-summary-value']} style={{ fontSize: 24 }}>
                            {visitorAnalytics?.averageEngagement || 0}
                          </div>
                          <div className={style['metric-helper']}>每位访客平均访问页数</div>
                        </div>
                      </div>
                    </>
                  ),
                })}
                {renderPanel({
                  title: '最近访问活动',
                  icon: <ClockCircleOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['insight-stack']}>
                      <div className={style['insight-item']}>
                        <div className={style['insight-label']}>最近访问时间</div>
                        <div className={style['insight-value']}>{recentVisitTime}</div>
                        <div className={style['insight-copy']}>
                          用于判断当前站点是否仍在产生新访问。
                        </div>
                      </div>
                      <div className={style['insight-item']}>
                        <div className={style['insight-label']}>最近访问路径</div>
                        <div className={style['insight-value']}>
                          {recentHref ? (
                            <a
                              href={recentHref}
                              target="_blank"
                              rel="noreferrer"
                              className={style['timeline-link']}
                            >
                              {data?.siteLastVisitedPathname || '-'}
                            </a>
                          ) : (
                            data?.siteLastVisitedPathname || '暂无访问记录'
                          )}
                        </div>
                        <div className={style['insight-copy']}>帮助快速定位最新流量落点。</div>
                      </div>
                      <div className={style['compact-summary-grid']}>
                        <div className={style['compact-summary-card']}>
                          <div className={style['metric-label']}>峰值表现</div>
                          <div className={style['score-summary-value']} style={{ fontSize: 24 }}>
                            {visitorAnalytics?.peakPerformance || 0}
                          </div>
                          <div className={style['metric-helper']}>单篇内容的最大访问峰值</div>
                        </div>
                        <div className={style['compact-summary-card']}>
                          <div className={style['metric-label']}>访客质量</div>
                          <Progress
                            percent={visitorAnalytics?.visitorQuality || 0}
                            strokeColor={WELCOME_CHART_COLORS.success[0]}
                            trailColor={palette.progressTrail}
                            showInfo={false}
                            className={style['metric-progress']}
                          />
                          <div className={style['metric-helper']}>
                            质量越高，说明用户浏览更深入。
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                })}
              </div>

              {renderPanel({
                title: compactRankView.title,
                icon: <TrophyOutlined className={style['chart-icon']} />,
                extra: (
                  <>
                    <div className={style['chart-switch']}>
                      <Segmented
                        size="small"
                        value={rankMode}
                        onChange={setRankMode}
                        options={[
                          { label: '热门文章', value: 'topViewer' },
                          { label: '最近访问', value: 'recentVisit' },
                          { label: '热门路径', value: 'topPath' },
                          { label: '最近活跃', value: 'recentPath' },
                        ]}
                      />
                    </div>
                    <NumSelect d="条" value={num} setValue={setNum} />
                  </>
                ),
                children: renderRankList({
                  items: compactRankView.items,
                  gradient: compactRankView.gradient,
                  emptyText: `${compactRankView.title}暂无数据`,
                  renderTitle: (item) =>
                    item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className={style['timeline-link']}
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    ),
                  renderMeta: (item) => <span className={style['meta-item']}>{item.meta}</span>,
                }),
              })}
            </>
          ) : (
            <>
              <div className={style['section-grid-3']}>
                {renderPanel({
                  title: '访客忠诚度分析',
                  icon: <HeartOutlined className={style['chart-icon']} />,
                  children: <Liquid {...liquidConfig} />,
                  note: '基于回访比例计算忠诚度指标。',
                })}
                {renderPanel({
                  title: '最近访问活动',
                  icon: <ClockCircleOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['section-body']}>
                      <div className={style['insight-stack']}>
                        <div className={style['insight-item']}>
                          <div className={style['insight-item-head']}>
                            <Tag color="blue">最近访问时间</Tag>
                          </div>
                          <div className={style['insight-value']}>{recentVisitTime}</div>
                        </div>
                        <div className={style['insight-item']}>
                          <div className={style['insight-item-head']}>
                            <Tag color="magenta">访问路径</Tag>
                          </div>
                          <div className={style['insight-value']}>
                            <a
                              href={recentHref}
                              target="_blank"
                              rel="noreferrer"
                              className={style['timeline-link']}
                            >
                              {data?.siteLastVisitedPathname || '暂无访问记录'}
                            </a>
                          </div>
                        </div>
                        <div className={style['insight-item']}>
                          <div className={style['insight-item-head']}>
                            <Tag color="green">访客质量</Tag>
                          </div>
                          <Progress
                            percent={visitorAnalytics?.visitorQuality || 0}
                            size="small"
                            strokeColor={WELCOME_CHART_COLORS.success[0]}
                            trailColor={palette.progressTrail}
                          />
                        </div>
                      </div>
                    </div>
                  ),
                })}
                {renderPanel({
                  title: '访客行为指标',
                  icon: <RiseOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['section-body']}>
                      <div className={style['section-stack']} style={{ gap: 16 }}>
                        <Card
                          size="small"
                          className={`${style['metric-highlight-card']} ${style['metric-highlight-primary']}`}
                        >
                          <Statistic
                            title="平均页面停留"
                            value={visitorAnalytics?.averageEngagement || 0}
                            suffix="页"
                          />
                        </Card>
                        <Card
                          size="small"
                          className={`${style['metric-highlight-card']} ${style['metric-highlight-accent']}`}
                        >
                          <Statistic
                            title="峰值表现"
                            value={visitorAnalytics?.peakPerformance || 0}
                            suffix="次"
                          />
                        </Card>
                      </div>
                    </div>
                  ),
                })}
              </div>

              <div className={style['section-grid-sidebar']}>
                {renderPanel({
                  title: '热门文章访问量排行',
                  icon: <TrophyOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="条" value={num} setValue={setNum} />,
                  children: <Column {...topArticlesConfig} />,
                })}
                <div className={style['sidebar-stack']}>
                  {renderPanel({
                    title: '最近访问 TOP',
                    icon: <ClockCircleOutlined className={style['chart-icon']} />,
                    extra: <NumSelect d="条" value={num} setValue={setNum} />,
                    children: renderRankList({
                      items: (data?.recentVisitArticles || []).slice(0, num).map((article) => ({
                        key: article.id,
                        title: article.title,
                        href: `/post/${article.id}`,
                        meta: getRecentTimeDes(article.lastVisitedTime),
                      })),
                      gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
                      emptyText: '暂无最近访问文章',
                      renderTitle: (item) => (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={style['timeline-link']}
                        >
                          {item.title}
                        </a>
                      ),
                      renderMeta: (item) => (
                        <span className={style['meta-item']}>
                          <ClockCircleOutlined className={style['meta-icon']} />
                          {item.meta}
                        </span>
                      ),
                    }),
                  })}
                  {renderPanel({
                    title: '访问量 TOP 榜',
                    icon: <FireOutlined className={style['chart-icon']} />,
                    extra: <NumSelect d="条" value={num} setValue={setNum} />,
                    children: renderRankList({
                      items: (data?.topViewer || []).slice(0, num).map((article) => ({
                        key: article.id,
                        title: article.title,
                        href: `/post/${article.id}`,
                        viewer: article.viewer,
                        visited: article.visited,
                      })),
                      gradient: 'linear-gradient(45deg, #f093fb, #f5576c)',
                      emptyText: '暂无热门文章',
                      renderTitle: (item) => (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={style['timeline-link']}
                        >
                          {item.title}
                        </a>
                      ),
                      renderMeta: (item) => (
                        <>
                          <span className={style['meta-item']}>
                            <EyeOutlined className={style['meta-icon']} />
                            {item.viewer} 次访问
                          </span>
                          <span className={style['meta-item']}>
                            <UserOutlined className={style['meta-icon']} />
                            {item.visited} 位访客
                          </span>
                        </>
                      ),
                    }),
                  })}
                  {renderPanel({
                    title: '热门访问路径',
                    icon: <LinkOutlined className={style['chart-icon']} />,
                    children: renderRankList({
                      items: (data?.topVisitedPaths || []).slice(0, num).map((item, index) => ({
                        key: `${item.pathname}-${index}`,
                        title: formatPathLabel(item.pathname),
                        viewer: item.viewer,
                        visited: item.visited,
                      })),
                      gradient: 'linear-gradient(45deg, #43e97b, #38f9d7)',
                      emptyText: '暂无路径数据',
                      renderTitle: (item) => item.title,
                      renderMeta: (item) => (
                        <>
                          <span className={style['meta-item']}>
                            <EyeOutlined className={style['meta-icon']} />
                            {item.viewer} 次访问
                          </span>
                          <span className={style['meta-item']}>
                            <UserOutlined className={style['meta-icon']} />
                            {item.visited} 位访客
                          </span>
                        </>
                      ),
                    }),
                  })}
                  {renderPanel({
                    title: '最近活跃路径',
                    icon: <GlobalOutlined className={style['chart-icon']} />,
                    children: renderRankList({
                      items: (data?.recentVisitedPaths || []).slice(0, num).map((item, index) => ({
                        key: `${item.pathname}-recent-${index}`,
                        title: formatPathLabel(item.pathname),
                        lastVisitedTime: item.lastVisitedTime,
                      })),
                      gradient: 'linear-gradient(45deg, #667eea, #764ba2)',
                      emptyText: '暂无最近活跃路径',
                      renderTitle: (item) => item.title,
                      renderMeta: (item) => (
                        <span className={style['meta-item']}>
                          <ClockCircleOutlined className={style['meta-icon']} />
                          {item.lastVisitedTime
                            ? getRecentTimeDes(item.lastVisitedTime)
                            : '暂无访问时间'}
                        </span>
                      ),
                    }),
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </Spin>
    </div>
  );
};

export default Viewer;
