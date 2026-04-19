import { Spin, Card, Progress, Empty } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import style from '../index.less';
import NumSelect from '@/components/NumSelect';
import { Pie, Column, Radar, Rose } from '@ant-design/plots';
import { useNum } from '@/services/van-blog/useNum';
import {
  FileTextOutlined,
  EditOutlined,
  FolderOutlined,
  TagsOutlined,
  TrophyOutlined,
  PieChartOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  StarOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import {
  WELCOME_CHART_COLORS,
  getWelcomeAreaFill,
  getWelcomeAxisStyle,
  getWelcomeLegendStyle,
  useWelcomeThemePalette,
} from '../theme';

const ArticleTab = ({ compact = false }) => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useNum(5);
  const palette = useWelcomeThemePalette();

  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('article', 5, 5, num);
    setData(res);
  }, [num]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => {
      setLoading(false);
    });
  }, [fetchData]);

  const creativeAnalytics = useMemo(
    () => ({
      avgWordsPerArticle: data?.articleNum > 0 ? Math.round(data?.wordNum / data?.articleNum) : 0,
      contentRichness: Math.min(100, Math.round((data?.wordNum || 0) / 1000)),
      categoryBalance:
        data?.categoryNum > 0 ? Math.round((data?.articleNum || 0) / data?.categoryNum) : 0,
      tagDiversity:
        data?.tagNum > 0 ? Math.round(((data?.articleNum || 0) / data?.tagNum) * 10) : 0,
      productivityScore: Math.min(
        100,
        Math.round(((data?.articleNum || 0) * 2 + (data?.wordNum || 0) / 1000) / 10),
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

  const compactCategoryData = useMemo(() => {
    const raw = (data?.categoryPieData || []).filter((item) => item.value > 0);
    if (!compact || raw.length <= 5) {
      return raw;
    }

    const sorted = [...raw].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 5);
    const restValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);

    return restValue > 0 ? [...top, { type: '其他', value: restValue }] : top;
  }, [compact, data?.categoryPieData]);

  const pieConfig = useMemo(
    () => ({
      data: compact ? compactCategoryData : data?.categoryPieData || [],
      angleField: 'value',
      colorField: 'type',
      radius: 0.82,
      innerRadius: 0.62,
      label: false,
      legend: compact
        ? false
        : getWelcomeLegendStyle(palette, {
            position: 'bottom',
            flipPage: false,
          }),
      color: chartColors,
      interactions: compact
        ? []
        : [
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
            fontSize: compact ? '20px' : '24px',
            fontWeight: 'bold',
            color: palette.statisticText,
          },
          content: `${data?.categoryNum || 0}个`,
        },
      },
    }),
    [chartColors, compact, compactCategoryData, data?.categoryNum, data?.categoryPieData, palette],
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

  const capabilityData = useMemo(
    () => [
      {
        name: '文章数量',
        value: Math.min(100, (data?.articleNum || 0) * 2),
        detail: `${data?.articleNum || 0} 篇`,
      },
      {
        name: '总字数',
        value: Math.min(100, (data?.wordNum || 0) / 1000),
        detail: `${data?.wordNum || 0} 字`,
      },
      {
        name: '分类丰富度',
        value: Math.min(100, (data?.categoryNum || 0) * 10),
        detail: `${data?.categoryNum || 0} 个分类`,
      },
      {
        name: '标签多样性',
        value: Math.min(100, (data?.tagNum || 0) * 5),
        detail: `${data?.tagNum || 0} 个标签`,
      },
      {
        name: '内容深度',
        value: Math.min(100, creativeAnalytics.avgWordsPerArticle / 20),
        detail: `平均 ${creativeAnalytics.avgWordsPerArticle} 字/篇`,
      },
    ],
    [
      creativeAnalytics.avgWordsPerArticle,
      data?.articleNum,
      data?.categoryNum,
      data?.tagNum,
      data?.wordNum,
    ],
  );

  const radarConfig = useMemo(
    () => ({
      data: capabilityData.map((item) => ({ name: item.name, value: item.value })),
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
    [capabilityData, palette],
  );

  const insightCards = [
    {
      label: '文章长度',
      value: creativeAnalytics.avgWordsPerArticle < 500 ? '建议提升长文深度' : '文章长度保持得不错',
      copy:
        creativeAnalytics.avgWordsPerArticle < 500
          ? '当前平均字数偏短，适合补充更多背景、案例或总结段。'
          : '平均字数已经具备深度文章雏形，可以继续强化结构。',
      tone:
        creativeAnalytics.avgWordsPerArticle < 500
          ? style['insight-card-warning']
          : style['insight-card-success'],
    },
    {
      label: '分类组织',
      value: data?.categoryNum < 5 ? '建议扩展分类结构' : '分类结构已经较均衡',
      copy:
        data?.categoryNum < 5
          ? '分类偏少会让归档和导航显得拥挤，可以按主题拆分。'
          : '分类数量和文章体量匹配，适合继续补充专题页。',
      tone: data?.categoryNum < 5 ? style['insight-card-info'] : style['insight-card-success'],
    },
    {
      label: '标签使用',
      value: creativeAnalytics.tagDiversity < 2 ? '建议补充更多主题标签' : '标签使用节奏不错',
      copy:
        creativeAnalytics.tagDiversity < 2
          ? '标签可以帮助读者串联相近文章，建议补足主题维度。'
          : '标签丰富度足够，后续可以继续维护热门主题合集。',
      tone:
        creativeAnalytics.tagDiversity < 2
          ? style['insight-card-warning']
          : style['insight-card-success'],
    },
  ];

  const kpiItems = [
    {
      icon: <FileTextOutlined />,
      value: data?.articleNum || 0,
      label: '文章总数',
      trend: `平均 ${creativeAnalytics.avgWordsPerArticle} 字/篇`,
    },
    {
      icon: <EditOutlined />,
      value: data?.wordNum || 0,
      label: '总字数',
      trend: `内容丰富度 ${creativeAnalytics.contentRichness}%`,
    },
    {
      icon: <FolderOutlined />,
      value: data?.categoryNum || 0,
      label: '分类数',
      trend: `平均 ${creativeAnalytics.categoryBalance} 篇/分类`,
    },
    {
      icon: <TagsOutlined />,
      value: data?.tagNum || 0,
      label: '标签数',
      trend: `多样性指数 ${creativeAnalytics.tagDiversity}`,
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

  const renderEmptyChart = (description) => (
    <div className={style['chart-empty']}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );

  const renderTagList = (items) => {
    if (!items.length) {
      return renderEmptyChart('暂无标签排行数据');
    }

    return (
      <div className={style['article-list-modern']}>
        {items.map((item, index) => (
          <div key={`${item.type}-${index}`} className={style['article-item']}>
            <div className={style['article-itemRow']}>
              <div
                className={`${style['rank-badge']} ${
                  index < 3 ? style['rank-badge-top'] : style['rank-badge-neutral']
                }`}
                style={
                  index < 3 ? { background: chartColors[index % chartColors.length] } : undefined
                }
              >
                {index + 1}
              </div>
              <div className={style['article-itemBody']}>
                <div className={style['article-title']}>{item.type}</div>
                <div className={style['article-meta']}>
                  <span className={style['meta-item']}>{item.value} 篇文章</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
              <div className={style['section-grid-2']}>
                {renderPanel({
                  title: '创作能力总览',
                  icon: <TrophyOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['metric-list']}>
                      {capabilityData.map((item) => (
                        <div key={item.name}>
                          <div className={style['metric-row-head']}>
                            <span className={style['metric-label']}>{item.name}</span>
                            <span className={style['metric-value']}>
                              {Math.round(item.value)} 分
                            </span>
                          </div>
                          <div className={style['metric-helper']}>{item.detail}</div>
                          <Progress
                            percent={Math.min(100, Math.round(item.value))}
                            strokeColor={WELCOME_CHART_COLORS.primary[0]}
                            trailColor={palette.progressTrail}
                            size="small"
                            showInfo={false}
                            className={style['metric-progress']}
                          />
                        </div>
                      ))}
                    </div>
                  ),
                  note: '手机端改成条形能力谱，读数比雷达图更直接。',
                })}
                {renderPanel({
                  title: '创作建议',
                  icon: <BulbOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['insight-stack']}>
                      {insightCards.map((item) => (
                        <Card
                          key={item.label}
                          size="small"
                          className={`${style['insight-card']} ${item.tone}`}
                        >
                          <div className={style['insight-label']}>{item.label}</div>
                          <div className={style['insight-value']}>{item.value}</div>
                          <div className={style['insight-copy']}>{item.copy}</div>
                        </Card>
                      ))}
                    </div>
                  ),
                })}
              </div>

              <div className={style['section-grid-2']}>
                {renderPanel({
                  title: '分类分布',
                  icon: <PieChartOutlined className={style['chart-icon']} />,
                  children:
                    compactCategoryData.length > 0 ? (
                      <>
                        <Pie {...pieConfig} height={250} />
                        <div className={style['distribution-legend']}>
                          {compactCategoryData.map((item, index) => (
                            <div key={item.type} className={style['distribution-item']}>
                              <span
                                className={style['distribution-swatch']}
                                style={{ background: chartColors[index % chartColors.length] }}
                              />
                              <div className={style['distribution-content']}>
                                <div className={style['distribution-name']}>{item.type}</div>
                                <div className={style['distribution-value']}>{item.value} 篇</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      renderEmptyChart('暂无分类分布数据')
                    ),
                  note:
                    compactCategoryData.length > 5
                      ? '仅展示前 5 个分类，其余分类已合并为“其他”。'
                      : '保留主分类环形图，并在下方给出紧凑图例。',
                })}
                {renderPanel({
                  title: '标签文章排行',
                  icon: <BarChartOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="条" value={num} setValue={setNum} />,
                  children: renderTagList((data?.columnData || []).slice(0, num)),
                })}
              </div>
            </>
          ) : (
            <>
              <div className={style['section-grid-3']}>
                {renderPanel({
                  title: '创作能力雷达图',
                  icon: <TrophyOutlined className={style['chart-icon']} />,
                  children: <Radar {...radarConfig} height={300} />,
                  note: '多维度评估创作水平。',
                })}
                {renderPanel({
                  title: '创作洞察',
                  icon: <BulbOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['metric-list']}>
                      <div>
                        <div className={style['metric-row-head']}>
                          <span className={style['metric-label']}>创作效率评分</span>
                          <span className={style['metric-value']}>
                            {creativeAnalytics.productivityScore} 分
                          </span>
                        </div>
                        <Progress
                          percent={creativeAnalytics.productivityScore}
                          strokeColor={WELCOME_CHART_COLORS.primary[0]}
                          trailColor={palette.progressTrail}
                          size="small"
                        />
                      </div>
                      <div>
                        <div className={style['metric-row-head']}>
                          <span className={style['metric-label']}>平均文章深度</span>
                          <span className={style['metric-value']}>
                            {Math.min(100, Math.round(creativeAnalytics.avgWordsPerArticle / 20))}{' '}
                            分
                          </span>
                        </div>
                        <Progress
                          percent={Math.min(100, creativeAnalytics.avgWordsPerArticle / 20)}
                          strokeColor={WELCOME_CHART_COLORS.accent[0]}
                          trailColor={palette.progressTrail}
                          size="small"
                        />
                      </div>
                      <div>
                        <div className={style['metric-row-head']}>
                          <span className={style['metric-label']}>分类组织能力</span>
                          <span className={style['metric-value']}>
                            {Math.min(100, Math.round(creativeAnalytics.categoryBalance * 5))} 分
                          </span>
                        </div>
                        <Progress
                          percent={Math.min(100, creativeAnalytics.categoryBalance * 5)}
                          strokeColor={WELCOME_CHART_COLORS.success[0]}
                          trailColor={palette.progressTrail}
                          size="small"
                        />
                      </div>
                    </div>
                  ),
                })}
                {renderPanel({
                  title: '创作建议',
                  icon: <ThunderboltOutlined className={style['chart-icon']} />,
                  children: (
                    <div className={style['insight-stack']}>
                      {insightCards.map((item) => (
                        <Card
                          key={item.label}
                          size="small"
                          className={`${style['insight-card']} ${item.tone}`}
                        >
                          <div className={style['insight-label']}>{item.label}</div>
                          <div className={style['insight-value']}>{item.value}</div>
                        </Card>
                      ))}
                    </div>
                  ),
                })}
              </div>

              <div className={style['section-grid-2']}>
                {renderPanel({
                  title: '分类分布环形图',
                  icon: <PieChartOutlined className={style['chart-icon']} />,
                  children:
                    (data?.categoryPieData || []).length > 0 ? (
                      <Pie {...pieConfig} height={320} />
                    ) : (
                      renderEmptyChart('暂无分类分布数据')
                    ),
                })}
                {renderPanel({
                  title: '标签文章数 TOP 排行',
                  icon: <BarChartOutlined className={style['chart-icon']} />,
                  extra: <NumSelect d="条" value={num} setValue={setNum} />,
                  children:
                    (data?.columnData || []).length > 0 ? (
                      <Column {...columnConfig} height={320} />
                    ) : (
                      renderEmptyChart('暂无标签排行数据')
                    ),
                })}
              </div>

              {(data?.categoryPieData || []).length > 0
                ? renderPanel({
                    title: '分类文章数玫瑰图',
                    icon: <StarOutlined className={style['chart-icon']} />,
                    children: <Rose {...roseConfig} height={400} />,
                    note: '以玫瑰图形式展示各分类的文章分布情况。',
                  })
                : null}
            </>
          )}
        </div>
      </Spin>
    </div>
  );
};

export default ArticleTab;
