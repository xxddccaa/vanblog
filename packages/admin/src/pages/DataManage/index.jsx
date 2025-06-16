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

export default function () {
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
  };
  const [tab, setTab] = useTab('category', 'tab');

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className={thinstyle.thinheader}
      tabActiveKey={tab}
      tabList={[
        {
          tab: '分类管理',
          key: 'category',
        },
        {
          tab: '标签管理',
          key: 'tag',
        },
        {
          tab: '导航配置',
          key: 'menuConfig',
        },
        {
          tab: '捐赠管理',
          key: 'donateInfo',
        },
        {
          tab: '友情链接',
          key: 'links',
        },
        {
          tab: '联系方式',
          key: 'socials',
        },
        {
          tab: '浏览量管理',
          key: 'viewer',
        },
        {
          tab: 'AI打标',
          key: 'aiTagging',
        },
        {
          tab: '文章管理',
          key: 'articleManager',
        },
      ]}
      onTabChange={setTab}
    >
      {tabMap[tab]}
    </PageContainer>
  );
}
