import ResponsivePageTabs, { toPageContainerTabList } from '@/components/ResponsivePageTabs';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import thinstyle from '../Welcome/index.less';
import NavTool from './tabs/NavTool';
import NavCategory from './tabs/NavCategory';
import NavIcon from './tabs/NavIcon';

export default function () {
  const { mobile } = useAdminResponsive();
  const tabMap = {
    tools: <NavTool />,
    categories: <NavCategory />,
    icons: <NavIcon />,
  };
  const tabKeys = Object.keys(tabMap);
  const [tab, setTab] = useTab('tools', 'tab', tabKeys);
  const tabs = [
    {
      label: '工具管理',
      shortLabel: '工具',
      key: 'tools',
    },
    {
      label: '分类管理',
      shortLabel: '分类',
      key: 'categories',
    },
    {
      label: '图标管理',
      shortLabel: '图标',
      key: 'icons',
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
