import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin, Row, Col, Card, Progress, Tag, Timeline, Tooltip } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import style from '../index.less';
import NumSelect from '@/components/NumSelect';
import { Pie, Column, Radar, WordCloud, Rose } from '@ant-design/plots';
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
  BulbOutlined
} from '@ant-design/icons';

const ArticleTab = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [responsive, setResponsive] = useState(false);
  const [num, setNum] = useNum(5);
  
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

  // 计算创作分析指标
  const creativeAnalytics = {
    avgWordsPerArticle: data?.articleNum > 0 ? Math.round(data?.wordNum / data?.articleNum) : 0,
    contentRichness: Math.min(100, Math.round((data?.wordNum || 0) / 1000)),
    categoryBalance: data?.categoryNum > 0 ? Math.round((data?.articleNum || 0) / data?.categoryNum) : 0,
    tagDiversity: data?.tagNum > 0 ? Math.round((data?.articleNum || 0) / data?.tagNum * 10) : 0,
    productivityScore: Math.min(100, Math.round(((data?.articleNum || 0) * 2 + (data?.wordNum || 0) / 1000) / 10)),
  };

  const pieConfig = {
    data: data?.categoryPieData || [],
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.6,
    label: {
      type: 'inner',
      offset: '-30%',
      content: ({ percent }) => `${(percent * 100).toFixed(0)}%`,
      style: {
        fontSize: 14,
        textAlign: 'center',
        fill: 'white',
        fontWeight: 'bold',
      },
    },
    legend: {
      position: 'bottom',
      flipPage: false,
    },
    color: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'],
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
          color: '#2c3e50',
        },
        content: `${data?.categoryNum || 0}个`,
      },
    },
  };

  const columnConfig = {
    data: data?.columnData || [],
    xField: 'type',
    yField: 'value',
    label: {
      position: 'top',
      style: {
        fill: '#5a6c7d',
        fontSize: 12,
        fontWeight: 'bold',
      },
    },
    color: ({ type, value }) => {
      const index = (data?.columnData || []).findIndex(item => item.type === type);
      const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#764ba2', '#f5576c', '#00f2fe', '#38f9d7'];
      return colors[index % colors.length];
    },
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
    xAxis: {
      label: {
        autoHide: true,
        autoRotate: false,
        style: {
          fontSize: 12,
        },
      },
    },
    meta: {
      type: { alias: '标签名' },
      value: { alias: '文章数量' },
    },
  };

  // 玫瑰图配置
  const roseConfig = {
    data: data?.categoryPieData || [],
    xField: 'type',
    yField: 'value',
    seriesField: 'type',
    radius: 0.9,
    label: {
      offset: -15,
      style: {
        fontSize: 12,
        fontWeight: 'bold',
        fill: 'white',
      },
    },
    color: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'],
  };

  // 雷达图数据
  const radarData = [
    { name: '文章数量', value: Math.min(100, (data?.articleNum || 0) * 2) },
    { name: '总字数', value: Math.min(100, (data?.wordNum || 0) / 1000) },
    { name: '分类丰富度', value: Math.min(100, (data?.categoryNum || 0) * 10) },
    { name: '标签多样性', value: Math.min(100, (data?.tagNum || 0) * 5) },
    { name: '内容深度', value: creativeAnalytics.avgWordsPerArticle / 20 },
  ];

  const radarConfig = {
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
      line: null,
      tickLine: null,
      grid: {
        line: {
          style: {
            lineDash: null,
          },
        },
      },
    },
    yAxis: {
      line: null,
      tickLine: null,
      grid: {
        line: {
          type: 'line',
          style: {
            lineDash: null,
          },
        },
        alternateColor: 'rgba(0, 0, 0, 0.04)',
      },
    },
    point: {
      size: 2,
    },
    area: {
      style: {
        fill: 'l(270) 0:#667eea 0.5:#764ba2 1:#f093fb',
        fillOpacity: 0.3,
      },
    },
    line: {
      style: {
        stroke: '#667eea',
        lineWidth: 2,
      },
    },
  };

  return (
    <div className={style['modern-welcome']}>
      <RcResizeObserver
        key="resize-observer"
        onResize={(offset) => {
          setResponsive(offset.width < 596);
        }}
      >
        <Spin spinning={loading}>
          {/* 核心指标卡片 */}
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

          {/* 创作能力分析 */}
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
                <div style={{ textAlign: 'center', marginTop: 16, color: '#7f8c8d', fontSize: 12 }}>
                  多维度评估创作水平
                </div>
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
                <div style={{ padding: '20px 0' }}>
                  <Timeline>
                    <Timeline.Item 
                      dot={<BookOutlined style={{ color: '#667eea' }} />}
                      color="#667eea"
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">内容产出</Tag>
                      </div>
                      <div style={{ color: '#2c3e50', marginBottom: 8 }}>
                        创作效率评分
                      </div>
                      <Progress 
                        percent={creativeAnalytics.productivityScore}
                        strokeColor="#667eea"
                        size="small"
                      />
                    </Timeline.Item>
                    <Timeline.Item 
                      dot={<StarOutlined style={{ color: '#f093fb' }} />}
                      color="#f093fb"
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="magenta">内容质量</Tag>
                      </div>
                      <div style={{ color: '#2c3e50', marginBottom: 8 }}>
                        平均文章深度
                      </div>
                      <Progress 
                        percent={Math.min(100, creativeAnalytics.avgWordsPerArticle / 20)}
                        strokeColor="#f093fb"
                        size="small"
                      />
                    </Timeline.Item>
                    <Timeline.Item 
                      dot={<CoffeeOutlined style={{ color: '#43e97b' }} />}
                      color="#43e97b"
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="green">写作习惯</Tag>
                      </div>
                      <div style={{ color: '#2c3e50', marginBottom: 8 }}>
                        分类组织能力
                      </div>
                      <Progress 
                        percent={Math.min(100, creativeAnalytics.categoryBalance * 5)}
                        strokeColor="#43e97b"
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
                <div style={{ padding: '20px 0' }}>
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Card 
                        size="small" 
                        style={{ 
                          background: creativeAnalytics.avgWordsPerArticle < 500 ? 
                            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 
                            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 
                          color: 'white', 
                          border: 'none' 
                        }}
                      >
                        <div style={{ fontSize: 12, opacity: 0.9 }}>文章长度建议</div>
                        <div style={{ fontWeight: 'bold', marginTop: 4 }}>
                          {creativeAnalytics.avgWordsPerArticle < 500 
                            ? '🚀 尝试写更长的深度文章' 
                            : '👍 文章长度很棒！'
                          }
                        </div>
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Card 
                        size="small" 
                        style={{ 
                          background: data?.categoryNum < 5 ? 
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
                          color: 'white', 
                          border: 'none' 
                        }}
                      >
                        <div style={{ fontSize: 12, opacity: 0.9 }}>分类管理建议</div>
                        <div style={{ fontWeight: 'bold', marginTop: 4 }}>
                          {data?.categoryNum < 5 
                            ? '📂 可以创建更多分类' 
                            : '🎯 分类结构合理！'
                          }
                        </div>
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Card 
                        size="small" 
                        style={{ 
                          background: creativeAnalytics.tagDiversity < 2 ? 
                            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 
                            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 
                          color: 'white', 
                          border: 'none' 
                        }}
                      >
                        <div style={{ fontSize: 12, opacity: 0.9 }}>标签使用建议</div>
                        <div style={{ fontWeight: 'bold', marginTop: 4 }}>
                          {creativeAnalytics.tagDiversity < 2 
                            ? '🏷️ 增加更多主题标签' 
                            : '✨ 标签使用得当！'
                          }
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>

          {/* 数据可视化分析 */}
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

          {/* 额外的玫瑰图展示 */}
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
                  <div style={{ textAlign: 'center', marginTop: 16, color: '#7f8c8d', fontSize: 12 }}>
                    以玫瑰图形式展示各分类的文章分布情况
                  </div>
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
