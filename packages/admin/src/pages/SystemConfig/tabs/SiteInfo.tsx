import ResponsivePageTabs from '@/components/ResponsivePageTabs';
import SiteInfoForm from '@/components/SiteInfoForm';
import { getSiteInfo, updateSiteInfo } from '@/services/van-blog/api';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useTab } from '@/services/van-blog/useTab';
import { ProForm } from '@ant-design/pro-components';
import { Card, message, Modal } from 'antd';
export default function () {
  const { mobile } = useAdminResponsive();
  const tabList = [
    {
      key: 'basic',
      label: '基本设置',
      shortLabel: '基本',
    },
    {
      key: 'more',
      label: '高级设置',
      shortLabel: '高级',
    },
    {
      key: 'layout',
      label: '布局设置',
      shortLabel: '布局',
    },
  ];
  const tabKeys = tabList.map((item) => item.key);
  const [tab, setTab] = useTab('basic', 'siteInfoTab', tabKeys);
  const [form] = ProForm.useForm();

  return (
    <Card
      tabList={
        mobile
          ? undefined
          : tabList.map((item) => ({
              key: item.key,
              tab: item.label,
            }))
      }
      onTabChange={setTab}
      activeTabKey={tab}
    >
      {mobile ? <ResponsivePageTabs items={tabList} activeKey={tab} onChange={setTab} /> : null}
      <ProForm
        form={form}
        grid={true}
        layout={mobile ? 'vertical' : 'horizontal'}
        labelCol={mobile ? undefined : { span: 6 }}
        request={async (params) => {
          const { data } = await getSiteInfo();
          return data;
        }}
        syncToInitialValues={true}
        onFinish={async (data) => {
          let ok = true;
          try {
            new URL(data.baseUrl);
          } catch (err) {
            ok = false;
          }
          if (!data.baseUrl) {
            ok = true;
          }
          if (!ok) {
            Modal.warn({
              title: '网站 URL 不合法！',
              content: (
                <div>
                  <p>请输入包含完整协议的 URL</p>
                  <p>例: https://blog-demo.mereith.com</p>
                </div>
              ),
            });
            return;
          }
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: '演示站禁止修改站点配置！' });
            return;
          }
          await updateSiteInfo(data);
          message.success('更新成功！');
        }}
      >
        <SiteInfoForm
          form={form}
          showLayout={tab == 'layout'}
          showOption={tab == 'more'}
          showRequire={tab == 'basic'}
          isInit={false}
        />
      </ProForm>
    </Card>
  );
}
