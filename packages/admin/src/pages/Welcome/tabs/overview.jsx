import NumSelect from '@/components/NumSelect';
import TipTitle from '@/components/TipTitle';
import { getWelcomeData } from '@/services/van-blog/api';
import { useNum } from '@/services/van-blog/useNum';
import { Area, Line, Column, Gauge } from '@ant-design/plots';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin, Progress, Tooltip, Row, Col } from 'antd';
import { 
  FileTextOutlined, 
  EyeOutlined, 
  UserOutlined, 
  EditOutlined,
  TrophyOutlined,
  CalendarOutlined,
  BarChartOutlined,
  HeartOutlined
} from '@ant-design/icons';
import RcResizeObserver from 'rc-resize-observer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import style from '../index.less';
const { Statistic } = StatisticCard;

const OverView = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useNum(5);
  const [responsive, setResponsive] = useState(false);
  
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

  // 计算一些有趣的指标
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
      engagementScore: Math.min(100, Math.round((totalViewer + totalVisited * 2) / 100))
    };
  }, [data]);

  const lineConfig = {
    data: totalData,
    xField: 'date',
    yField: '访问量',
    height: 200,
    smooth: true,
    color: '#667eea',
    point: {
      size: 4,
      color: '#667eea',
    },
    area: {
      style: {
        fill: 'l(270) 0:#ffffff 0.5:#667eea 1:#764ba2',
        fillOpacity: 0.3,
      },
    },
  };
  
  const eachConfig = {
    data: eachData,
    xField: 'date',
    yField: '访客数',
    height: 200,
    smooth: true,
    color: '#f093fb',
    point: {
      size: 4,
      color: '#f093fb',
    },
    area: {
      style: {
        fill: 'l(270) 0:#ffffff 0.5:#f093fb 1:#f5576c',
        fillOpacity: 0.3,
      },
    },
  };

  const productivityGaugeConfig = {
    percent: interestingMetrics?.productivityScore / 100 || 0,
    height: 200,
    color: ['#30BF78', '#FAAD14', '#F4664A'],
    innerRadius: 0.75,
    statistic: {
      title: {
        formatter: () => '创作指数',
        style: {
          fontSize: '14px',
          color: '#5a6c7d',
        },
      },
      content: {
        style: {
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#2c3e50',
        },
        formatter: () => `${interestingMetrics?.productivityScore || 0}分`,
      },
    },
  };

  const engagementGaugeConfig = {
    percent: interestingMetrics?.engagementScore / 100 || 0,
    height: 200,
    color: ['#30BF78', '#FAAD14', '#F4664A'],
    innerRadius: 0.75,
    statistic: {
      title: {
        formatter: () => '受欢迎指数',
        style: {
          fontSize: '14px',
          color: '#5a6c7d',
        },
      },
      content: {
        style: {
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#2c3e50',
        },
        formatter: () => `${interestingMetrics?.engagementScore || 0}分`,
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
          {/* 主要指标卡片 */}
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

          {/* 趋势图表 */}
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
                <Area {...eachConfig} />
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
                <Line {...lineConfig} />
              </div>
            </Col>
          </Row>

          {/* 仪表盘和进度指标 */}
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={8}>
              <div className={style['chart-container']}>
                <div className={style['chart-header']}>
                  <div className={style['chart-title']}>
                    <TrophyOutlined className={style['chart-icon']} />
                    创作力评估
                  </div>
                </div>
                <Gauge {...productivityGaugeConfig} />
                <div style={{ textAlign: 'center', marginTop: 16, color: '#7f8c8d', fontSize: 12 }}>
                  基于文章数量和字数综合评估
                </div>
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
                <Gauge {...engagementGaugeConfig} />
                <div style={{ textAlign: 'center', marginTop: 16, color: '#7f8c8d', fontSize: 12 }}>
                  基于访问量和访客数综合评估
                </div>
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
                <div style={{ padding: '20px 0' }}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#5a6c7d' }}>今日新增访客</span>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                        {data?.viewer?.add?.visited || 0}
                      </span>
                    </div>
                    <Progress 
                      percent={Math.min(100, (data?.viewer?.add?.visited || 0) * 2)} 
                      strokeColor="#667eea"
                      size="small"
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#5a6c7d' }}>今日新增访问</span>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                        {data?.viewer?.add?.viewer || 0}
                      </span>
                    </div>
                    <Progress 
                      percent={Math.min(100, (data?.viewer?.add?.viewer || 0) * 1.5)} 
                      strokeColor="#f093fb"
                      size="small"
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#5a6c7d' }}>平均文章热度</span>
                      <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                        {interestingMetrics?.avgViewerPerArticle || 0}
                      </span>
                    </div>
                    <Progress 
                      percent={Math.min(100, (interestingMetrics?.avgViewerPerArticle || 0) / 2)} 
                      strokeColor="#4facfe"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* 累计趋势图表 */}
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
                <Area 
                  {...totalData.length > 0 ? {
                    data: totalData,
                    xField: 'date',
                    yField: '访客数',
                    height: 200,
                    smooth: true,
                    color: '#43e97b',
                    point: { size: 4, color: '#43e97b' },
                    area: {
                      style: {
                        fill: 'l(270) 0:#ffffff 0.5:#43e97b 1:#38f9d7',
                        fillOpacity: 0.3,
                      },
                    },
                  } : { data: [], height: 200 }}
                />
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
                <Line {...lineConfig} />
              </div>
            </Col>
          </Row>
        </Spin>
      </RcResizeObserver>
    </div>
  );
};

export default OverView;
