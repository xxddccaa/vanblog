import { Spin, Row, Col, Card, Statistic, Progress, Timeline, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import style from '../index.less';
import NumSelect from '@/components/NumSelect';
import { useNum } from '@/services/van-blog/useNum';
import RcResizeObserver from 'rc-resize-observer';
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
import {
  WELCOME_CHART_COLORS,
  getWelcomeAxisStyle,
  useWelcomeThemePalette,
} from '../theme';

const Viewer = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [responsive, setResponsive] = useState(false);
  const [num, setNum] = useNum(5);
  const palette = useWelcomeThemePalette();

  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('viewer', 5, num);
    setData(res);
  }, [setData, num]);

  useEffect(() => {
    setLoading(true);
    fetchData().then(() => {
      setLoading(false);
    });
  }, [fetchData, setLoading]);

  const recentHref = useMemo(() => {
    if (!data) {
      return undefined;
    }
    if (!data?.siteLastVisitedPathname) {
      return undefined;
    }
    return data?.siteLastVisitedPathname;
  }, [data]);

  const recentVisitTime = useMemo(() => {
    if (!data) {
      return '-';
    }
    if (!data.siteLastVisitedTime) {
      return '-';
    }
    return getRecentTimeDes(data?.siteLastVisitedTime);
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
      averageEngagement: totalVisited > 0 ? Math.round((totalViewer / totalVisited) * 100) / 100 : 0,
      peakPerformance: Math.max(maxArticleVisited, maxArticleViewer),
      visitorQuality: totalVisited > 0 ? Math.min(100, Math.round((totalViewer / totalVisited) * 20)) : 0,
    };
  }, [data]);

  const liquidConfig = useMemo(
    () => ({
      percent: visitorAnalytics?.loyaltyRate / 100 || 0,
      height: 200,
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
      height: 300,
      color: WELCOME_CHART_COLORS.accent[0],
      columnStyle: {
        radius: [4, 4, 0, 0],
      },
      xAxis: getWelcomeAxisStyle(palette),
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

  return (
    <div className={style['modern-welcome']}>
      <RcResizeObserver
        key="resize-observer"
        onResize={(offset) => {
          setResponsive(offset.width < 596);
        }}
      >
        <Spin spinning={loading}>
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <TeamOutlined />
                </div>
                <div className={style['stat-number']}>{data?.totalVisited || 0}</div>
                <div className={style['stat-label']}>总访客数</div>
                <div className={style['stat-trend'] + ' up'}>
                  🎯 忠诚度 {visitorAnalytics?.loyaltyRate || 0}%
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <EyeOutlined />
                </div>
                <div className={style['stat-number']}>{data?.totalViewer || 0}</div>
                <div className={style['stat-label']}>总访问数</div>
                <div className={style['stat-trend'] + ' up'}>
                  📊 平均互动 {visitorAnalytics?.averageEngagement || 0}次
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <TrophyOutlined />
                </div>
                <div className={style['stat-number']}>{data?.maxArticleVisited || 0}</div>
                <div className={style['stat-label']}>单篇最高访客</div>
                <div className={style['stat-trend'] + ' up'}>🏆 优质内容表现</div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <FireOutlined />
                </div>
                <div className={style['stat-number']}>{data?.maxArticleViewer || 0}</div>
                <div className={style['stat-label']}>单篇最高访问</div>
                <div className={style['stat-trend'] + ' up'}>🔥 爆款文章热度</div>
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <HeartOutlined className={style['chart-icon']} />
                    访客忠诚度分析
                  </div>
                </div>
                <Liquid {...liquidConfig} />
                <div className={style['section-note']}>基于回访比例计算忠诚度指标</div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <ClockCircleOutlined className={style['chart-icon']} />
                    最近访问活动
                  </div>
                </div>
                <div className={style['section-body']}>
                  <Timeline>
                    <Timeline.Item dot={<ClockCircleOutlined style={{ color: WELCOME_CHART_COLORS.primary[0] }} />} color={WELCOME_CHART_COLORS.primary[0]}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">最近访问时间</Tag>
                      </div>
                      <div className={style['timeline-value']}>{recentVisitTime}</div>
                    </Timeline.Item>
                    <Timeline.Item dot={<LinkOutlined style={{ color: WELCOME_CHART_COLORS.accent[0] }} />} color={WELCOME_CHART_COLORS.accent[0]}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="magenta">访问路径</Tag>
                      </div>
                      <div style={{ color: palette.textPrimary, fontSize: 12 }}>
                        <a href={recentHref} target="_blank" rel="noreferrer" className={style['timeline-link']}>
                          {data?.siteLastVisitedPathname || '暂无访问记录'}
                        </a>
                      </div>
                    </Timeline.Item>
                    <Timeline.Item dot={<GlobalOutlined style={{ color: WELCOME_CHART_COLORS.success[0] }} />} color={WELCOME_CHART_COLORS.success[0]}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="green">访客质量</Tag>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress
                          percent={visitorAnalytics?.visitorQuality || 0}
                          size="small"
                          strokeColor={WELCOME_CHART_COLORS.success[0]}
                          trailColor={palette.progressTrail}
                          style={{ flex: 1 }}
                        />
                        <span className={style['metric-value']} style={{ fontSize: 12 }}>
                          {visitorAnalytics?.visitorQuality || 0}分
                        </span>
                      </div>
                    </Timeline.Item>
                  </Timeline>
                </div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <RiseOutlined className={style['chart-icon']} />
                    访客行为指标
                  </div>
                </div>
                <div className={style['section-body']}>
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Card size="small" className={`${style['metric-highlight-card']} ${style['metric-highlight-primary']}`}>
                        <Statistic
                          title="平均页面停留"
                          value={visitorAnalytics?.averageEngagement || 0}
                          suffix="页"
                        />
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Card size="small" className={`${style['metric-highlight-card']} ${style['metric-highlight-accent']}`}>
                        <Statistic
                          title="峰值表现"
                          value={visitorAnalytics?.peakPerformance || 0}
                          suffix="次"
                        />
                      </Card>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={14}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <TrophyOutlined className={style['chart-icon']} />
                    热门文章访问量排行
                  </div>
                  <NumSelect d="条" value={num} setValue={setNum} />
                </div>
                <Column {...topArticlesConfig} />
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <Row gutter={[0, 24]}>
                <Col span={24}>
                  <div className={style['chart-container']}>
                    <div className={style['chart-header']}>
                      <div className={style['chart-title']}>
                        <ClockCircleOutlined className={style['chart-icon']} />
                        最近访问TOP
                      </div>
                      <NumSelect d="条" value={num} setValue={setNum} />
                    </div>
                    <div className={style['article-list-modern']}>
                      {(data?.recentVisitArticles || []).slice(0, num).map((article, index) => {
                        const rankBadge = getRankBadgeProps(index, 'linear-gradient(45deg, #667eea, #764ba2)');
                        return (
                          <div key={article.id} className="article-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div {...rankBadge}>{index + 1}</div>
                              <div style={{ flex: 1 }}>
                                <div className="article-title">
                                  <a href={`/post/${article.id}`} target="_blank" rel="noreferrer" className={style['timeline-link']}>
                                    {article.title}
                                  </a>
                                </div>
                                <div className="article-meta">
                                  <span className="meta-item">
                                    <ClockCircleOutlined className="meta-icon" />
                                    {getRecentTimeDes(article.lastVisitedTime)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
                <Col span={24}>
                  <div className={style['chart-container']}>
                    <div className={style['chart-header']}>
                      <div className={style['chart-title']}>
                        <FireOutlined className={style['chart-icon']} />
                        访问量TOP榜
                      </div>
                      <NumSelect d="条" value={num} setValue={setNum} />
                    </div>
                    <div className={style['article-list-modern']}>
                      {(data?.topViewer || []).slice(0, num).map((article, index) => {
                        const rankBadge = getRankBadgeProps(index, 'linear-gradient(45deg, #f093fb, #f5576c)');
                        return (
                          <div key={article.id} className="article-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div {...rankBadge}>{index + 1}</div>
                              <div style={{ flex: 1 }}>
                                <div className="article-title">
                                  <a href={`/post/${article.id}`} target="_blank" rel="noreferrer" className={style['timeline-link']}>
                                    {article.title}
                                  </a>
                                </div>
                                <div className="article-meta">
                                  <span className="meta-item">
                                    <EyeOutlined className="meta-icon" />
                                    {article.viewer}次访问
                                  </span>
                                  <span className="meta-item">
                                    <UserOutlined className="meta-icon" />
                                    {article.visited}位访客
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
                <Col span={24}>
                  <div className={style['chart-container']}>
                    <div className={style['chart-header']}>
                      <div className={style['chart-title']}>
                        <LinkOutlined className={style['chart-icon']} />
                        热门访问路径
                      </div>
                    </div>
                    <div className={style['article-list-modern']}>
                      {(data?.topVisitedPaths || []).slice(0, num).map((item, index) => {
                        const rankBadge = getRankBadgeProps(index, 'linear-gradient(45deg, #43e97b, #38f9d7)');
                        return (
                          <div key={`${item.pathname}-${index}`} className="article-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div {...rankBadge}>{index + 1}</div>
                              <div style={{ flex: 1 }}>
                                <div className="article-title" title={item.pathname}>
                                  {formatPathLabel(item.pathname)}
                                </div>
                                <div className="article-meta">
                                  <span className="meta-item">
                                    <EyeOutlined className="meta-icon" />
                                    {item.viewer}次访问
                                  </span>
                                  <span className="meta-item">
                                    <UserOutlined className="meta-icon" />
                                    {item.visited}位访客
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
                <Col span={24}>
                  <div className={style['chart-container']}>
                    <div className={style['chart-header']}>
                      <div className={style['chart-title']}>
                        <ClockCircleOutlined className={style['chart-icon']} />
                        最近活跃路径
                      </div>
                    </div>
                    <div className={style['article-list-modern']}>
                      {(data?.recentVisitedPaths || []).slice(0, num).map((item, index) => {
                        const rankBadge = getRankBadgeProps(index, 'linear-gradient(45deg, #667eea, #764ba2)');
                        return (
                          <div key={`${item.pathname}-recent-${index}`} className="article-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div {...rankBadge}>{index + 1}</div>
                              <div style={{ flex: 1 }}>
                                <div className="article-title" title={item.pathname}>
                                  {formatPathLabel(item.pathname)}
                                </div>
                                <div className="article-meta">
                                  <span className="meta-item">
                                    <ClockCircleOutlined className="meta-icon" />
                                    {item.lastVisitedTime ? getRecentTimeDes(item.lastVisitedTime) : '暂无访问时间'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Spin>
      </RcResizeObserver>
    </div>
  );
};

export default Viewer;
