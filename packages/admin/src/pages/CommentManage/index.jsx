import { PageContainer } from '@ant-design/pro-layout';
import { Button, Modal, Space, Spin, notification } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { history } from '@umijs/max';
import TipTitle from '../../components/TipTitle';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
export default function () {
  const { mobile } = useAdminResponsive();
  const [loading, setLoading] = useState(true);
  const { current } = useRef({ hasInit: false });
  const src = '/api/ui/';
  const frameHeight = mobile ? 'calc(100dvh - 150px)' : 'calc(100dvh - 170px)';

  const tipContent = (
    <div>
      <p>
        Vanblog 内嵌了{' '}
        <a target={'_blank'} rel="noreferrer" href="https://waline.js.org/">
          Waline
        </a>{' '}
        作为评论系统。
      </p>
      <p>本管理页面也是内嵌的 Waline 后台管理页面。</p>
      <p>首次使用请先注册，首个注册的用户将默认成为管理员。</p>
    </div>
  );

  const showTips = () => {
    Modal.info({
      title: '使用说明',
      content: tipContent,
    });
  };
  useEffect(() => {
    if (!current.hasInit) {
      current.hasInit = true;
      if (!localStorage.getItem('CommentTipped')) {
        localStorage.setItem('CommentTipped', 'true');
        notification.info({
          key: 'comment-manage-tips',
          message: 'Waline 使用提示',
          description: tipContent,
          duration: 8,
          placement: 'topRight',
        });
      }
    }
  }, [current]);
  return (
    <PageContainer
      style={{ overflow: 'hidden' }}
      title={null}
      extra={
        <Space>
          <Button
            type="primary"
            onClick={() => {
              history.push(`/site/setting?tab=waline`);
            }}
          >
            设置
          </Button>
          <Button onClick={showTips}>帮助</Button>
        </Space>
      }
      header={{
        title: (
          <TipTitle
            title="评论管理"
            tip="基于内嵌的 Waline，首个注册的用户即为管理员。未来会用自己的实现替代 Waline"
          />
        ),
      }}
    >
      <Spin spinning={loading} style={{ display: 'block' }}>
        <div
          style={{
            height: frameHeight,
            minHeight: mobile ? 520 : 720,
          }}
        >
          <iframe
            onLoad={() => {
              setLoading(false);
            }}
            title="waline 后台"
            src={src}
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block',
            }}
          ></iframe>
        </div>
      </Spin>
    </PageContainer>
  );
}
