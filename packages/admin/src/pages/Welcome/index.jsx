import { useTab } from '@/services/van-blog/useTab';
import {
  BarChartOutlined,
  DotChartOutlined,
  FundProjectionScreenOutlined,
} from '@ant-design/icons';
import { Grid } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import style from './index.less';
import Article from './tabs/article';
import OverView from './tabs/overview';
import Viewer from './tabs/viewer';

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

const Welcome = () => {
  const tabKeys = tabs.map((item) => item.key);
  const [tab, setTab] = useTab('overview', 'tab', tabKeys);
  const screens = Grid.useBreakpoint();
  const compact = !screens.md;
  const mobile = Boolean(screens.xs) && !screens.sm;

  const tabMap = {
    overview: <OverView compact={compact} mobile={mobile} />,
    viewer: <Viewer compact={compact} mobile={mobile} />,
    article: <Article compact={compact} mobile={mobile} />,
  };

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
          {tabMap[tab]}
        </div>
      </PageContainer>
    </div>
  );
};

export default Welcome;
