import { useTab } from '@/services/van-blog/useTab';
import {
  BarChartOutlined,
  DotChartOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { Button, Grid, Spin } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import React, { Component, lazy, Suspense, useMemo, useState } from 'react';
import style from './index.less';

const defaultTabLoaders = {
  overview: () => import('./tabs/overview'),
  viewer: () => import('./tabs/viewer'),
  article: () => import('./tabs/article'),
};

export class WelcomeTabErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" data-testid="welcome-tab-error">
          <p>统计标签加载失败</p>
          <Button type="primary" onClick={this.props.onRetry}>
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const tabs = [
  {
    key: 'overview',
    label: '数据概览',
    shortLabel: '概览',
    icon: <BarChartOutlined className={style['welcome-tab-icon']} />,
  },
  {
    key: 'viewer',
    label: '访客统计',
    shortLabel: '访客',
    icon: <DotChartOutlined className={style['welcome-tab-icon']} />,
  },
  {
    key: 'article',
    label: '文章分析',
    shortLabel: '文章',
    icon: <FundProjectionScreenOutlined className={style['welcome-tab-icon']} />,
  },
];

const Welcome = ({ tabLoaders = defaultTabLoaders }) => {
  const tabKeys = tabs.map((item) => item.key);
  const [tab, setTab] = useTab('overview', 'tab', tabKeys);
  const [attempt, setAttempt] = useState(0);
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  const mobile = Boolean(screens.xs) && !screens.sm;

  const tabComponentMap = useMemo(
    () => ({
      overview: lazy(tabLoaders.overview),
      viewer: lazy(tabLoaders.viewer),
      article: lazy(tabLoaders.article),
    }),
    [attempt, tabLoaders],
  );
  const ActiveTab = tabComponentMap[tab] || tabComponentMap.overview;

  return (
    <div className={style['modern-welcome']}>
      <PageContainer
        extra={null}
        header={{ title: null, extra: null, ghost: true }}
        className={`${style.thinheader} ${style.welcomePageContainer}`}
        onTabChange={setTab}
        tabActiveKey={tab}
        tabList={
          compact
            ? undefined
            : tabs.map((item) => ({
                key: item.key,
                tab: (
                  <span className={style['welcome-desktop-tab']}>
                    {item.icon}
                    {item.label}
                  </span>
                ),
              }))
        }
        title={null}
      >
        <div className={style['welcome-content-frame']}>
          {compact ? (
            <div className={style['welcome-mobile-tabs']}>
              {tabs.map((item) => {
                const active = item.key === tab;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`${style['welcome-mobile-tab']} ${
                      active ? style['welcome-mobile-tabActive'] : ''
                    }`}
                    onClick={() => setTab(item.key)}
                  >
                    {item.icon}
                    <span>{mobile ? item.shortLabel : item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <WelcomeTabErrorBoundary
            key={`${tab}-${attempt}`}
            onRetry={() => setAttempt((current) => current + 1)}
          >
            <Suspense
              fallback={
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <Spin />
                </div>
              }
            >
              <ActiveTab compact={compact} mobile={mobile} />
            </Suspense>
          </WelcomeTabErrorBoundary>
        </div>
      </PageContainer>
    </div>
  );
};

export default Welcome;
