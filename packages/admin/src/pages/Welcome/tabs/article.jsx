import { Spin, Row, Col, Card, Progress, Tag, Timeline } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import style from '../index.less';
import NumSelect from '@/components/NumSelect';
import { Pie, Column, Radar, Rose } from '@ant-design/plots';
import { useNum } from '@/services/van-blog/useNum';
import RcResizeObserver from 'rc-resize-observer';
import {
  FileTextOutlined,
  EditOutlined,
  FolderOutlined,
  TagsOutlined,
  TrophyOutlined,
  BookOutlined,
  PieChartOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  StarOutlined,
  CoffeeOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import {
  WELCOME_CHART_COLORS,
  getWelcomeAreaFill,
  getWelcomeAxisStyle,
  getWelcomeLegendStyle,
  useWelcomeThemePalette,
} from '../theme';

const ArticleTab = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [responsive, setResponsive] = useState(false);
  const [num, setNum] = useNum(5);
  const palette = useWelcomeThemePalette();

  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('article', 5, 5, num);
    setData(res);
  }, [setData, num]);

  useEffect(() => {
    setLoading(true);
    fetchData().then(() => {
      setLoading(false);
    });
  }, [fetchData, setLoading]);

  const creativeAnalytics = useMemo(
    () => ({
      avgWordsPerArticle: data?.articleNum > 0 ? Math.round(data?.wordNum / data?.articleNum) : 0,
      contentRichness: Math.min(100, Math.round((data?.wordNum || 0) / 1000)),
      categoryBalance: data?.categoryNum > 0 ? Math.round((data?.articleNum || 0) / data?.categoryNum) : 0,
      tagDiversity: data?.tagNum > 0 ? Math.round(((data?.articleNum || 0) / data?.tagNum) * 10) : 0,
      productivityScore: Math.min(
        100,
        Math.round((((data?.articleNum || 0) * 2 + (data?.wordNum || 0) / 1000) / 10)),
      ),
    }),
    [data?.articleNum, data?.categoryNum, data?.tagNum, data?.wordNum],
  );

  const chartColors = useMemo(
    () => [
      WELCOME_CHART_COLORS.primary[0],
      WELCOME_CHART_COLORS.primary[1],
      WELCOME_CHART_COLORS.accent[0],
      WELCOME_CHART_COLORS.accent[1],
      WELCOME_CHART_COLORS.cyan[0],
      WELCOME_CHART_COLORS.cyan[1],
      WELCOME_CHART_COLORS.success[0],
      WELCOME_CHART_COLORS.success[1],
    ],
    [],
  );

  const pieConfig = useMemo(
    () => ({
      data: data?.categoryPieData || [],
      angleField: 'value',
      colorField: 'type',
      radius: 0.8,
      innerRadius: 0.6,
      label: false,
      legend: getWelcomeLegendStyle(palette, {
        position: 'bottom',
        flipPage: false,
      }),
      color: chartColors,
      interactions: [
        { type: 'element-selected' },
        { type: 'element-active' },
        { type: 'pie-statistic-active' },
      ],
      statistic: {
        title: {
          style: {
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fill: palette.textSecondary,
          },
          content: '分类分布',
        },
        content: {
          style: {
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '24px',
            fontWeight: 'bold',
            color: palette.statisticText,
          },
          content: `${data?.categoryNum || 0}个`,
        },
      },
    }),
    [chartColors, data?.categoryNum, data?.categoryPieData, palette],
  );

  const columnConfig = useMemo(
    () => ({
      data: data?.columnData || [],
      xField: 'type',
      yField: 'value',
      label: {
        position: 'top',
        style: {
          fill: palette.chartLabel,
          fontSize: 12,
          fontWeight: 'bold',
        },
      },
      color: ({ type }) => {
        const index = (data?.columnData || []).findIndex((item) => item.type === type);
        return chartColors[index % chartColors.length];
      },
      columnStyle: {
        radius: [4, 4, 0, 0],
      },
      xAxis: getWelcomeAxisStyle(palette),
      yAxis: getWelcomeAxisStyle(palette, true),
      meta: {
        type: { alias: '标签名' },
        value: { alias: '文章数量' },
      },
    }),
    [chartColors, data?.columnData, palette],
  );

  const roseConfig = useMemo(
    () => ({
      data: data?.categoryPieData || [],
      xField: 'type',
      yField: 'value',
      seriesField: 'type',
      radius: 0.9,
      legend: getWelcomeLegendStyle(palette, { position: 'bottom' }),
      label: {
        offset: palette.isDark ? 12 : -15,
        style: {
          fontSize: 12,
          fontWeight: 'bold',
          fill: palette.roseLabel,
        },
      },
      labelLine: palette.isDark
        ? {
            style: {
              stroke: palette.chartGrid,
            },
          }
        : undefined,
      color: chartColors,
    }),
    [chartColors, data?.categoryPieData, palette],
  );

  const radarData = useMemo(
    () => [
      { name: '文章数量', value: Math.min(100, (data?.articleNum || 0) * 2) },
      { name: '总字数', value: Math.min(100, (data?.wordNum || 0) / 1000) },
      { name: '分类丰富度', value: Math.min(100, (data?.categoryNum || 0) * 10) },
      { name: '标签多样性', value: Math.min(100, (data?.tagNum || 0) * 5) },
      { name: '内容深度', value: creativeAnalytics.avgWordsPerArticle / 20 },
    ],
    [creativeAnalytics.avgWordsPerArticle, data?.articleNum, data?.categoryNum, data?.tagNum, data?.wordNum],
  );

  const radarConfig = useMemo(
    () => ({
      data: radarData,
      xField: 'name',
      yField: 'value',
      appendPadding: [0, 10, 0, 10],
      meta: {
        value: {
          alias: '得分',
          min: 0,
          max: 100,
        },
      },
      xAxis: {
        label: {
          style: {
            fill: palette.chartLabel,
          },
        },
        line: null,
        tickLine: null,
        grid: {
          line: {
            style: {
              stroke: palette.chartGrid,
              lineDash: null,
            },
          },
        },
      },
      yAxis: {
        label: {
          style: {
            fill: palette.textTertiary,
          },
        },
        line: null,
        tickLine: null,
        grid: {
          line: {
            type: 'line',
            style: {
              stroke: palette.chartGrid,
              lineDash: null,
            },
          },
          alternateColor: palette.isDark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(0, 0, 0, 0.04)',
        },
      },
      point: {
        size: 2,
      },
      area: {
        style: {
          fill: getWelcomeAreaFill(
            WELCOME_CHART_COLORS.primary[0],
            WELCOME_CHART_COLORS.accent[0],
            palette,
          ),
          fillOpacity: palette.isDark ? 0.22 : 0.3,
        },
      },
      line: {
        style: {
          stroke: WELCOME_CHART_COLORS.primary[0],
          lineWidth: 2,
        },
      },
    }),
    [palette, radarData],
  );

  const lengthCardTone =
    creativeAnalytics.avgWordsPerArticle < 500 ? style['insight-card-warning'] : style['insight-card-success'];
  const categoryCardTone = data?.categoryNum < 5 ? style['insight-card-info'] : style['insight-card-success'];
  const tagCardTone = creativeAnalytics.tagDiversity < 2 ? style['insight-card-warning'] : style['insight-card-success'];

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
                <div className={style['stat-number']}>{data?.articleNum || 0}</div>
                <div className={style['stat-label']}>文章总数</div>
                <div className={style['stat-trend'] + ' up'}>
                  📚 平均 {creativeAnalytics.avgWordsPerArticle} 字/篇
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <EditOutlined />
                </div>
                <div className={style['stat-number']}>{data?.wordNum || 0}</div>
                <div className={style['stat-label']}>总字数</div>
                <div className={style['stat-trend'] + ' up'}>
                  ✍️ 内容丰富度 {creativeAnalytics.contentRichness}%
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <FolderOutlined />
                </div>
                <div className={style['stat-number']}>{data?.categoryNum || 0}</div>
                <div className={style['stat-label']}>分类数</div>
                <div className={style['stat-trend'] + ' up'}>
                  📁 平均 {creativeAnalytics.categoryBalance} 篇/分类
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <TagsOutlined />
                </div>
                <div className={style['stat-number']}>{data?.tagNum || 0}</div>
                <div className={style['stat-label']}>标签数</div>
                <div className={style['stat-trend'] + ' up'}>
                  🏷️ 多样性指数 {creativeAnalytics.tagDiversity}
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <TrophyOutlined className={style['chart-icon']} />
                    创作能力雷达图
                  </div>
                </div>
                <Radar {...radarConfig} height={280} />
                <div className={style['section-note']}>多维度评估创作水平</div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <BulbOutlined className={style['chart-icon']} />
                    创作洞察
                  </div>
                </div>
                <div className={style['section-body']}>
                  <Timeline>
                    <Timeline.Item dot={<BookOutlined style={{ color: WELCOME_CHART_COLORS.primary[0] }} />} color={WELCOME_CHART_COLORS.primary[0]}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">内容产出</Tag>
                      </div>
                      <div className={style['timeline-value']} style={{ marginBottom: 8 }}>
                        创作效率评分
                      </div>
                      <Progress
                        percent={creativeAnalytics.productivityScore}
                        strokeColor={WELCOME_CHART_COLORS.primary[0]}
                        trailColor={palette.progressTrail}
                        size="small"
                      />
                    </Timeline.Item>
                    <Timeline.Item dot={<StarOutlined style={{ color: WELCOME_CHART_COLORS.accent[0] }} />} color={WELCOME_CHART_COLORS.accent[0]}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="magenta">内容质量</Tag>
                      </div>
                      <div className={style['timeline-value']} style={{ marginBottom: 8 }}>
                        平均文章深度
                      </div>
                      <Progress
                        percent={Math.min(100, creativeAnalytics.avgWordsPerArticle / 20)}
                        strokeColor={WELCOME_CHART_COLORS.accent[0]}
                        trailColor={palette.progressTrail}
                        size="small"
                      />
                    </Timeline.Item>
                    <Timeline.Item dot={<CoffeeOutlined style={{ color: WELCOME_CHART_COLORS.success[0] }} />} color={WELCOME_CHART_COLORS.success[0]}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="green">写作习惯</Tag>
                      </div>
                      <div className={style['timeline-value']} style={{ marginBottom: 8 }}>
                        分类组织能力
                      </div>
                      <Progress
                        percent={Math.min(100, creativeAnalytics.categoryBalance * 5)}
                        strokeColor={WELCOME_CHART_COLORS.success[0]}
                        trailColor={palette.progressTrail}
                        size="small"
                      />
                    </Timeline.Item>
                  </Timeline>
                </div>
              </div>
            </Col>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <ThunderboltOutlined className={style['chart-icon']} />
                    创作建议
                  </div>
                </div>
                <div className={style['section-body']}>
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Card size="small" className={`${style['insight-card']} ${lengthCardTone}`}>
                        <div className={style['insight-label']}>文章长度建议</div>
                        <div className={style['insight-value']}>
                          {creativeAnalytics.avgWordsPerArticle < 500 ? '🚀 尝试写更长的深度文章' : '👍 文章长度很棒！'}
                        </div>
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Card size="small" className={`${style['insight-card']} ${categoryCardTone}`}>
                        <div className={style['insight-label']}>分类管理建议</div>
                        <div className={style['insight-value']}>
                          {data?.categoryNum < 5 ? '📂 可以创建更多分类' : '🎯 分类结构合理！'}
                        </div>
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Card size="small" className={`${style['insight-card']} ${tagCardTone}`}>
                        <div className={style['insight-label']}>标签使用建议</div>
                        <div className={style['insight-value']}>
                          {creativeAnalytics.tagDiversity < 2 ? '🏷️ 增加更多主题标签' : '✨ 标签使用得当！'}
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <PieChartOutlined className={style['chart-icon']} />
                    分类分布环形图
                  </div>
                </div>
                <Pie {...pieConfig} height={300} />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <BarChartOutlined className={style['chart-icon']} />
                    标签文章数TOP排行
                  </div>
                  <NumSelect d="条" value={num} setValue={setNum} />
                </div>
                <Column {...columnConfig} height={300} />
              </div>
            </Col>
          </Row>

          {data?.categoryPieData && data.categoryPieData.length > 0 && (
            <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
              <Col span={24}>
                <div className={style['chart-container']}>
                  <div className={style['chart-header']}>
                    <div className={style['chart-title']}>
                      <StarOutlined className={style['chart-icon']} />
                      分类文章数玫瑰图
                    </div>
                  </div>
                  <Rose {...roseConfig} height={400} />
                  <div className={style['section-note']}>以玫瑰图形式展示各分类的文章分布情况</div>
                </div>
              </Col>
            </Row>
          )}
        </Spin>
      </RcResizeObserver>
    </div>
  );
};

export default ArticleTab;
