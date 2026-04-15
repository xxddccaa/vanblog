import NumSelect from '@/components/NumSelect';
import { getWelcomeData } from '@/services/van-blog/api';
import { useNum } from '@/services/van-blog/useNum';
import { Area, Line } from '@ant-design/plots';
import { Spin, Progress, Row, Col, Empty } from 'antd';
import {
  FileTextOutlined,
  EyeOutlined,
  UserOutlined,
  EditOutlined,
  TrophyOutlined,
  CalendarOutlined,
  BarChartOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import RcResizeObserver from 'rc-resize-observer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import style from '../index.less';
import {
  WELCOME_CHART_COLORS,
  getWelcomeAreaFill,
  getWelcomeAxisStyle,
  useWelcomeThemePalette,
} from '../theme';

const OverView = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useNum(5);
  const [responsive, setResponsive] = useState(false);
  const palette = useWelcomeThemePalette();

  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('overview', num);
    setData(res);
  }, [setData, num]);

  useEffect(() => {
    setLoading(true);
    fetchData().then(() => {
      setLoading(false);
    });
  }, [fetchData, setLoading]);

  const eachData = useMemo(() => {
    const res = [];
    for (const each of data?.viewer?.grid?.each || []) {
      res.push({
        date: each.date,
        访客数: each.visited,
        访问量: each.viewer,
      });
    }
    return res;
  }, [data]);

  const totalData = useMemo(() => {
    const res = [];
    for (const each of data?.viewer?.grid?.total || []) {
      res.push({
        date: each.date,
        访客数: each.visited,
        访问量: each.viewer,
      });
    }
    return res;
  }, [data]);

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

  const lineConfig = useMemo(
    () => ({
      data: totalData,
      xField: 'date',
      yField: '访问量',
      height: 200,
      smooth: true,
      color: WELCOME_CHART_COLORS.primary[0],
      point: {
        size: 4,
        color: WELCOME_CHART_COLORS.primary[0],
      },
      xAxis: getWelcomeAxisStyle(palette),
      yAxis: getWelcomeAxisStyle(palette, true),
      area: {
        style: {
          fill: getWelcomeAreaFill(
            WELCOME_CHART_COLORS.primary[0],
            WELCOME_CHART_COLORS.primary[1],
            palette,
          ),
          fillOpacity: palette.isDark ? 0.2 : 0.3,
        },
      },
    }),
    [palette, totalData],
  );

  const eachConfig = useMemo(
    () => ({
      data: eachData,
      xField: 'date',
      yField: '访客数',
      height: 200,
      smooth: true,
      color: WELCOME_CHART_COLORS.accent[0],
      point: {
        size: 4,
        color: WELCOME_CHART_COLORS.accent[0],
      },
      xAxis: getWelcomeAxisStyle(palette),
      yAxis: getWelcomeAxisStyle(palette, true),
      area: {
        style: {
          fill: getWelcomeAreaFill(
            WELCOME_CHART_COLORS.accent[0],
            WELCOME_CHART_COLORS.accent[1],
            palette,
          ),
          fillOpacity: palette.isDark ? 0.2 : 0.3,
        },
      },
    }),
    [eachData, palette],
  );

  const totalVisitedConfig = useMemo(
    () => ({
      data: totalData,
      xField: 'date',
      yField: '访客数',
      height: 200,
      smooth: true,
      color: WELCOME_CHART_COLORS.success[0],
      point: {
        size: 4,
        color: WELCOME_CHART_COLORS.success[0],
      },
      xAxis: getWelcomeAxisStyle(palette),
      yAxis: getWelcomeAxisStyle(palette, true),
      area: {
        style: {
          fill: getWelcomeAreaFill(
            WELCOME_CHART_COLORS.success[0],
            WELCOME_CHART_COLORS.success[1],
            palette,
          ),
          fillOpacity: palette.isDark ? 0.2 : 0.3,
        },
      },
    }),
    [palette, totalData],
  );

  const hasVisitorTrendData = eachData.length >= 2;
  const hasTotalTrendData = totalData.length >= 2;
  const hasEnoughOverviewMetrics = Boolean(data);

  const renderEmptyChart = (description) => (
    <div
      style={{
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );

  const renderDashboardProgress = (score, strokeColor) => (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
      <Progress
        type="dashboard"
        percent={Math.max(0, Math.min(100, score || 0))}
        strokeColor={strokeColor}
        trailColor={palette.progressTrail}
        format={() => <span style={{ color: palette.textPrimary }}>{score || 0}分</span>}
      />
    </div>
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
                  <FileTextOutlined />
                </div>
                <div className={style['stat-number']}>{data?.total?.articleNum || 0}</div>
                <div className={style['stat-label']}>文章总数</div>
                <div className={style['stat-trend'] + ' up'}>
                  📝 平均 {interestingMetrics?.avgWordsPerArticle || 0} 字/篇
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <EditOutlined />
                </div>
                <div className={style['stat-number']}>{data?.total?.wordCount || 0}</div>
                <div className={style['stat-label']}>总字数</div>
                <div className={style['stat-trend'] + ' up'}>
                  ✍️ 相当于 {Math.round((data?.total?.wordCount || 0) / 500)} 页书
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <UserOutlined />
                </div>
                <div className={style['stat-number']}>{data?.viewer?.now?.visited || 0}</div>
                <div className={style['stat-label']}>总访客数</div>
                <div className={style['stat-trend'] + ' up'}>
                  🎯 回访率 {interestingMetrics?.retentionRate || 0}%
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <EyeOutlined />
                </div>
                <div className={style['stat-number']}>{data?.viewer?.now?.viewer || 0}</div>
                <div className={style['stat-label']}>总访问数</div>
                <div className={style['stat-trend'] + ' up'}>
                  📈 今日增长 {interestingMetrics?.todayGrowthRate || 0}%
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <BarChartOutlined className={style['chart-icon']} />
                    访客数趋势
                  </div>
                  <NumSelect d="天" value={num} setValue={setNum} />
                </div>
                {hasVisitorTrendData ? <Area {...eachConfig} /> : renderEmptyChart('访客趋势数据不足，至少需要 2 天数据')}
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <BarChartOutlined className={style['chart-icon']} />
                    访问量趋势
                  </div>
                  <NumSelect d="天" value={num} setValue={setNum} />
                </div>
                {hasTotalTrendData ? <Line {...lineConfig} /> : renderEmptyChart('访问趋势数据不足，至少需要 2 天数据')}
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <TrophyOutlined className={style['chart-icon']} />
                    创作力评估
                  </div>
                </div>
                {hasEnoughOverviewMetrics
                  ? renderDashboardProgress(interestingMetrics?.productivityScore || 0, '#30BF78')
                  : renderEmptyChart('等待概览数据加载')}
                <div className={style['section-note']}>基于文章数量和字数综合评估</div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <HeartOutlined className={style['chart-icon']} />
                    受欢迎程度
                  </div>
                </div>
                {hasEnoughOverviewMetrics
                  ? renderDashboardProgress(interestingMetrics?.engagementScore || 0, '#f093fb')
                  : renderEmptyChart('等待概览数据加载')}
                <div className={style['section-note']}>基于访问量和访客数综合评估</div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <CalendarOutlined className={style['chart-icon']} />
                    今日表现
                  </div>
                </div>
                <div className={style['section-body']}>
                  <div className={style['progress-metric']}>
                    <div className={style['progress-meta']}>
                      <span className={style['metric-label']}>今日新增访客</span>
                      <span className={style['metric-value']}>{data?.viewer?.add?.visited || 0}</span>
                    </div>
                    <Progress
                      percent={Math.min(100, (data?.viewer?.add?.visited || 0) * 2)}
                      strokeColor={WELCOME_CHART_COLORS.primary[0]}
                      trailColor={palette.progressTrail}
                      size="small"
                    />
                  </div>
                  <div className={style['progress-metric']}>
                    <div className={style['progress-meta']}>
                      <span className={style['metric-label']}>今日新增访问</span>
                      <span className={style['metric-value']}>{data?.viewer?.add?.viewer || 0}</span>
                    </div>
                    <Progress
                      percent={Math.min(100, (data?.viewer?.add?.viewer || 0) * 1.5)}
                      strokeColor={WELCOME_CHART_COLORS.accent[0]}
                      trailColor={palette.progressTrail}
                      size="small"
                    />
                  </div>
                  <div className={style['progress-metric']}>
                    <div className={style['progress-meta']}>
                      <span className={style['metric-label']}>平均文章热度</span>
                      <span className={style['metric-value']}>{interestingMetrics?.avgViewerPerArticle || 0}</span>
                    </div>
                    <Progress
                      percent={Math.min(100, (interestingMetrics?.avgViewerPerArticle || 0) / 2)}
                      strokeColor={WELCOME_CHART_COLORS.cyan[0]}
                      trailColor={palette.progressTrail}
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <BarChartOutlined className={style['chart-icon']} />
                    累计访客数趋势
                  </div>
                  <NumSelect d="天" value={num} setValue={setNum} />
                </div>
                {hasTotalTrendData ? <Area {...totalVisitedConfig} /> : renderEmptyChart('累计访客趋势数据不足，至少需要 2 天数据')}
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <BarChartOutlined className={style['chart-icon']} />
                    累计访问量趋势
                  </div>
                  <NumSelect d="天" value={num} setValue={setNum} />
                </div>
                {hasTotalTrendData ? <Line {...lineConfig} /> : renderEmptyChart('累计访问趋势数据不足，至少需要 2 天数据')}
              </div>
            </Col>
          </Row>
        </Spin>
      </RcResizeObserver>
    </div>
  );
};

export default OverView;
