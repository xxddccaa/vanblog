import ResponsivePageTabs, { toPageContainerTabList } from '@/components/ResponsivePageTabs';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import thinstyle from '../Welcome/index.less';
import Category from './tabs/Category';
import Donate from './tabs/Donate';
import Link from './tabs/Link';
import Menu from './tabs/Menu';
import Social from './tabs/Social';
import Tag from './tabs/Tag';
import Viewer from './tabs/Viewer';
import AITagging from './tabs/AITagging';
import ArticleManager from './tabs/ArticleManager';
import Music from './tabs/Music';

export default function () {
  const { mobile } = useAdminResponsive();
  const tabMap = {
    category: <Category />,
    tag: <Tag />,
    donateInfo: <Donate />,
    links: <Link />,
    socials: <Social />,
    viewer: <Viewer />,
    menuConfig: <Menu />,
    aiTagging: <AITagging />,
    articleManager: <ArticleManager />,
    music: <Music />,
  };
  const tabKeys = Object.keys(tabMap);
  const [tab, setTab] = useTab('category', 'tab', tabKeys);
  const tabs = [
    {
      label: '分类管理',
      shortLabel: '分类',
      key: 'category',
    },
    {
      label: '标签管理',
      shortLabel: '标签',
      key: 'tag',
    },
    {
      label: '导航配置',
      shortLabel: '导航',
      key: 'menuConfig',
    },
    {
      label: '捐赠管理',
      shortLabel: '捐赠',
      key: 'donateInfo',
    },
    {
      label: '友情链接',
      shortLabel: '友链',
      key: 'links',
    },
    {
      label: '联系方式',
      shortLabel: '联系',
      key: 'socials',
    },
    {
      label: '浏览量管理',
      shortLabel: '浏览量',
      key: 'viewer',
    },
    {
      label: 'AI打标',
      shortLabel: 'AI打标',
      key: 'aiTagging',
    },
    {
      label: '文章管理',
      shortLabel: '文章',
      key: 'articleManager',
    },
    {
      label: '音乐管理',
      shortLabel: '音乐',
      key: 'music',
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
