import ResponsivePageTabs, { toPageContainerTabList } from '@/components/ResponsivePageTabs';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import thinstyle from '../Welcome/index.less';
import Login from './tabs/Login';
import Pipeline from './tabs/Pipeline';
import System from './tabs/System';
export default function () {
  const { mobile } = useAdminResponsive();
  const tabMap = {
    login: <Login />,
    pipeline: <Pipeline />,
    system: <System />,
  };
  const tabKeys = Object.keys(tabMap);
  const [tab, setTab] = useTab('system', 'tab', tabKeys);
  const tabs = [
    {
      label: '系统日志',
      shortLabel: '系统',
      key: 'system',
    },
    {
      label: '流水线日志',
      shortLabel: '流水线',
      key: 'pipeline',
    },
    {
      label: '登录日志',
      shortLabel: '登录',
      key: 'login',
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
      {tabMap[tab]}
    </PageContainer>
  );
}
