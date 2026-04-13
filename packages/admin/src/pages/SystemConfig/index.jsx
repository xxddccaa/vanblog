import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import { Spin } from 'antd';
import { lazy, Suspense } from 'react';
import thinstyle from '../Welcome/index.less';

const SiteInfo = lazy(() => import('./tabs/SiteInfo'));
const Customizing = lazy(() => import('./tabs/Customizing'));
const Backup = lazy(() => import('./tabs/Backup'));
const AutoBackup = lazy(() => import('./tabs/AutoBackup'));
const User = lazy(() => import('./tabs/User'));
const ImgTab = lazy(() => import('./tabs/ImgTab'));
const WalineTab = lazy(() => import('./tabs/WalineTab'));
const Advance = lazy(() => import('./tabs/Advance'));
const Token = lazy(() => import('./tabs/Token'));
const AdminLayout = lazy(() => import('./tabs/AdminLayout'));

const tabComponentMap = {
  siteInfo: SiteInfo,
  customizing: Customizing,
  backup: Backup,
  autoBackup: AutoBackup,
  user: User,
  img: ImgTab,
  waline: WalineTab,
  advance: Advance,
  token: Token,
  adminLayout: AdminLayout,
};

export default function () {
  const tabKeys = Object.keys(tabComponentMap);
  const [tab, setTab] = useTab('siteInfo', 'tab', tabKeys);
  const ActiveTab = tabComponentMap[tab] || SiteInfo;

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className={thinstyle.thinheader}
      tabActiveKey={tab}
      tabList={[
        {
          tab: '站点配置',
          key: 'siteInfo',
        },
        {
          tab: '客制化',
          key: 'customizing',
        },
        {
          tab: '用户设置',
          key: 'user',
        },
        {
          tab: '图床设置',
          key: 'img',
        },
        {
          tab: '评论设置',
          key: 'waline',
        },
        {
          tab: '备份恢复',
          key: 'backup',
        },
        {
          tab: '自动备份',
          key: 'autoBackup',
        },
        {
          tab: 'Token 管理',
          key: 'token',
        },
        {
          tab: '后台布局',
          key: 'adminLayout',
        },
        {
          tab: '高级设置',
          key: 'advance',
        },
      ]}
      onTabChange={setTab}
    >
      <Suspense
        fallback={
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Spin />
          </div>
        }
      >
        <ActiveTab />
      </Suspense>
    </PageContainer>
  );
}
