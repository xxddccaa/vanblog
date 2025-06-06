import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import style from './index.less';
import Article from './tabs/article';
import OverView from './tabs/overview';
import Viewer from './tabs/viewer';

const Welcome = () => {
  const [tab, setTab] = useTab('overview', 'tab');

  // const { initialState } = useModel('@@initialState');
  const tabMap = {
    overview: <OverView />,
    viewer: <Viewer />,
    article: <Article />,
  };
  // const showCommentBtn = useMemo(() => {
  //   const url = initialState?.walineServerUrl;
  //   if (!url || url == '') {
  //     return false;
  //   }
  //   return true;
  // }, [initialState]);
  return (
    <div className={style['modern-welcome']}>
      <PageContainer
        // title={null}
        extra={null}
        header={{ title: null, extra: null, ghost: true }}
        className={style.thinheader}
        onTabChange={(k) => {
          setTab(k);
        }}
        tabActiveKey={tab}
        tabList={[
          {
            tab: '📊 数据概览',
            key: 'overview',
          },
          {
            tab: '👥 访客统计',
            key: 'viewer',
          },
          {
            tab: '📝 文章分析',
            key: 'article',
          },
        ]}
        title={null}
        // extra={
        //   <Space>
        //     {showCommentBtn && (
        //       <Button
        //         type="primary"
        //         onClick={() => {
        //           const urlRaw = data?.link?.walineServerUrl || '';
        //           if (urlRaw == '') {
        //             return;
        //           }
        //           const u = new URL(urlRaw).toString();
        //           window.open(`${u}ui`, '_blank');
        //         }}
        //       >
        //         评论管理
        //       </Button>
        //     )}
        //     <Button
        //       type="primary"
        //       onClick={() => {
        //         const urlRaw = data?.link?.baseUrl || '';
        //         if (urlRaw == '') {
        //           return;
        //         }

        //         window.open(`${urlRaw}`, '_blank');
        //       }}
        //     >
        //       前往主站
        //     </Button>
        //   </Space>
        // }
      >
        {tabMap[tab]}
      </PageContainer>
    </div>
  );
};

export default Welcome;
