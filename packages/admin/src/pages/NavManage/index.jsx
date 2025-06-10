import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import thinstyle from '../Welcome/index.less';
import NavTool from './tabs/NavTool';
import NavCategory from './tabs/NavCategory';
import NavIcon from './tabs/NavIcon';

export default function () {
  const tabMap = {
    tools: <NavTool />,
    categories: <NavCategory />,
    icons: <NavIcon />,
  };
  const [tab, setTab] = useTab('tools', 'tab');

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className={thinstyle.thinheader}
      tabActiveKey={tab}
      tabList={[
        {
          tab: '工具管理',
          key: 'tools',
        },
        {
          tab: '分类管理',
          key: 'categories',
        },
        {
          tab: '图标管理',
          key: 'icons',
        },
      ]}
      onTabChange={setTab}
    >
      {tabMap[tab]}
    </PageContainer>
  );
} 