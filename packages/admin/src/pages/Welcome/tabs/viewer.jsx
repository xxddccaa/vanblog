import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin, Row, Col, Card, Statistic, Progress, Timeline, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import ArticleList from '@/components/ArticleList';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import { Link } from 'umi';
import TipTitle from '@/components/TipTitle';
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
  HeartOutlined
} from '@ant-design/icons';
import { Liquid, Column, WordCloud } from '@ant-design/plots';

const Viewer = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [responsive, setResponsive] = useState(false);
  const [num, setNum] = useNum(5);
  
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

  // 计算访客分析指标
  const visitorAnalytics = useMemo(() => {
    if (!data) return null;
    
    const totalVisited = data?.totalVisited || 0;
    const totalViewer = data?.totalViewer || 0;
    const maxArticleVisited = data?.maxArticleVisited || 0;
    const maxArticleViewer = data?.maxArticleViewer || 0;
    
    return {
      loyaltyRate: totalViewer > 0 ? Math.round((totalVisited / totalViewer) * 100) : 0,
      averageEngagement: totalVisited > 0 ? Math.round(totalViewer / totalVisited * 100) / 100 : 0,
      peakPerformance: Math.max(maxArticleVisited, maxArticleViewer),
      visitorQuality: totalVisited > 0 ? Math.min(100, Math.round(totalViewer / totalVisited * 20)) : 0
    };
  }, [data]);

  // 访客忠诚度液体图配置
  const liquidConfig = {
    percent: visitorAnalytics?.loyaltyRate / 100 || 0,
    height: 200,
    shape: 'diamond',
    color: ['#667eea', '#764ba2'],
    statistic: {
      title: {
        formatter: () => '访客忠诚度',
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
        formatter: () => `${visitorAnalytics?.loyaltyRate || 0}%`,
      },
    },
  };

  // 热门文章访问量柱状图
  const topArticlesConfig = {
    data: (data?.topViewer || []).slice(0, 10).map(article => ({
      title: article.title.length > 15 ? article.title.substring(0, 15) + '...' : article.title,
      viewer: article.viewer,
      visited: article.visited
    })),
    xField: 'title',
    yField: 'viewer',
    height: 300,
    color: '#f093fb',
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
    meta: {
      title: { alias: '文章标题' },
      viewer: { alias: '访问量' },
    },
    label: {
      position: 'top',
      style: {
        fill: '#5a6c7d',
        fontSize: 12,
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
                <div className={style['stat-trend'] + ' up'}>
                  🏆 优质内容表现
                </div>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className={style['stat-card']}>
                <div className={style['stat-icon']}>
                  <FireOutlined />
                </div>
                <div className={style['stat-number']}>{data?.maxArticleViewer || 0}</div>
                <div className={style['stat-label']}>单篇最高访问</div>
                <div className={style['stat-trend'] + ' up'}>
                  🔥 爆款文章热度
                </div>
              </div>
            </Col>
          </Row>

          {/* 访客行为分析 */}
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
                <div style={{ textAlign: 'center', marginTop: 16, color: '#7f8c8d', fontSize: 12 }}>
                  基于回访比例计算忠诚度指标
                </div>
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
                <div style={{ padding: '20px 0' }}>
                  <Timeline>
                    <Timeline.Item 
                      dot={<ClockCircleOutlined style={{ color: '#667eea' }} />}
                      color="#667eea"
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">最近访问时间</Tag>
                      </div>
                      <div style={{ color: '#2c3e50', fontWeight: 600 }}>
                        {recentVisitTime}
                      </div>
                    </Timeline.Item>
                    <Timeline.Item 
                      dot={<LinkOutlined style={{ color: '#f093fb' }} />}
                      color="#f093fb"
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="magenta">访问路径</Tag>
                      </div>
                      <div style={{ color: '#2c3e50', fontSize: 12 }}>
                        <a 
                          href={recentHref} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: '#667eea' }}
                        >
                          {data?.siteLastVisitedPathname || '暂无访问记录'}
                        </a>
                      </div>
                    </Timeline.Item>
                    <Timeline.Item 
                      dot={<GlobalOutlined style={{ color: '#43e97b' }} />}
                      color="#43e97b"
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="green">访客质量</Tag>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress 
                          percent={visitorAnalytics?.visitorQuality || 0}
                          size="small"
                          strokeColor="#43e97b"
                          style={{ flex: 1 }}
                        />
                        <span style={{ color: '#2c3e50', fontSize: 12, fontWeight: 600 }}>
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
                <div style={{ padding: '20px 0' }}>
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Card size="small" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none' }}>
                        <Statistic
                          title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>平均页面停留</span>}
                          value={visitorAnalytics?.averageEngagement || 0}
                          suffix="页"
                          valueStyle={{ color: 'white' }}
                        />
                      </Card>
                    </Col>
                    <Col span={24}>
                      <Card size="small" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', border: 'none' }}>
                        <Statistic
                          title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>峰值表现</span>}
                          value={visitorAnalytics?.peakPerformance || 0}
                          suffix="次"
                          valueStyle={{ color: 'white' }}
                        />
                      </Card>
                    </Col>
                  </Row>
                </div>
              </div>
            </Col>
          </Row>

          {/* 文章访问排行榜 */}
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
                      {(data?.recentVisitArticles || []).slice(0, num).map((article, index) => (
                        <div key={article.id} className="article-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ 
                              width: 24, 
                              height: 24, 
                              borderRadius: '50%', 
                              background: index < 3 ? 'linear-gradient(45deg, #667eea, #764ba2)' : '#f0f0f0',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              color: index < 3 ? 'white' : '#999',
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="article-title">
                                <a 
                                  href={`/post/${article.id}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  style={{ color: 'inherit', textDecoration: 'none' }}
                                >
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
                      ))}
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
                      {(data?.topViewer || []).slice(0, num).map((article, index) => (
                        <div key={article.id} className="article-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ 
                              width: 24, 
                              height: 24, 
                              borderRadius: '50%', 
                              background: index < 3 ? 'linear-gradient(45deg, #f093fb, #f5576c)' : '#f0f0f0',
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              color: index < 3 ? 'white' : '#999',
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="article-title">
                                <a 
                                  href={`/post/${article.id}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  style={{ color: 'inherit', textDecoration: 'none' }}
                                >
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
                      ))}
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
