import ResponsivePageTabs, { toPageContainerTabList } from '@/components/ResponsivePageTabs';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import { Spin } from 'antd';
import { history } from '@umijs/max';
import { lazy, Suspense, useEffect } from 'react';
import thinstyle from '../Welcome/index.less';

const SiteInfo = lazy(() => import('./tabs/SiteInfo'));
const Customizing = lazy(() => import('./tabs/Customizing'));
const Font = lazy(() => import('./tabs/Font'));
const Backup = lazy(() => import('./tabs/Backup'));
const AutoBackup = lazy(() => import('./tabs/AutoBackup'));
const User = lazy(() => import('./tabs/User'));
const ImgTab = lazy(() => import('./tabs/ImgTab'));
const CommentTab = lazy(() => import('./tabs/CommentTab'));
const PublicMask = lazy(() => import('./tabs/PublicMask'));
const Advance = lazy(() => import('./tabs/Advance'));
const Token = lazy(() => import('./tabs/Token'));
const AdminLayout = lazy(() => import('./tabs/AdminLayout'));

const tabComponentMap = {
  siteInfo: SiteInfo,
  customizing: Customizing,
  font: Font,
  backup: Backup,
  autoBackup: AutoBackup,
  user: User,
  img: ImgTab,
  comment: CommentTab,
  publicMask: PublicMask,
  advance: Advance,
  token: Token,
  adminLayout: AdminLayout,
};

// Old links such as `?tab=waline` keep opening the comment settings.
const legacyTabAliases = {
  waline: 'comment',
};

export default function () {
  const { mobile } = useAdminResponsive();
  const tabKeys = [...Object.keys(tabComponentMap), ...Object.keys(legacyTabAliases)];
  const [rawTab, setTab] = useTab('siteInfo', 'tab', tabKeys);
  const tab = legacyTabAliases[rawTab] || rawTab;
  const ActiveTab = tabComponentMap[tab] || SiteInfo;

  useEffect(() => {
    if (legacyTabAliases[rawTab]) {
      const search = new URLSearchParams(history.location.search || '');
      search.set('tab', legacyTabAliases[rawTab]);
      history.replace({ search: `?${search.toString()}` });
    }
  }, [rawTab]);
  const tabs = [
    {
      label: '站点配置',
      shortLabel: '站点',
      key: 'siteInfo',
    },
    {
      label: '客制化',
      shortLabel: '客制化',
      key: 'customizing',
    },
    {
      label: '字体设置',
      shortLabel: '字体',
      key: 'font',
    },
    {
      label: '用户设置',
      shortLabel: '用户',
      key: 'user',
    },
    {
      label: '图床设置',
      shortLabel: '图床',
      key: 'img',
    },
    {
      label: '评论设置',
      shortLabel: '评论',
      key: 'comment',
    },
    {
      label: '前台屏蔽',
      shortLabel: '屏蔽',
      key: 'publicMask',
    },
    {
      label: '备份恢复',
      shortLabel: '备份',
      key: 'backup',
    },
    {
      label: '自动备份',
      shortLabel: '自动备份',
      key: 'autoBackup',
    },
    {
      label: 'Token 管理',
      shortLabel: 'Token',
      key: 'token',
    },
    {
      label: '后台布局',
      shortLabel: '布局',
      key: 'adminLayout',
    },
    {
      label: '高级设置',
      shortLabel: '高级',
      key: 'advance',
    },
  ];

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className={thinstyle.thinheader}
      tabActiveKey={tab}
      tabList={mobile ? undefined : toPageContainerTabList(tabs)}
      onTabChange={setTab}
    >
      {mobile ? <ResponsivePageTabs items={tabs} activeKey={tab} onChange={setTab} /> : null}
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
