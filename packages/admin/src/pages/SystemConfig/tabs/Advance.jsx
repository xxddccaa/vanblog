import {
  activeISR,
  getISRConfig,
  getLoginConfig,
  updateISRConfig,
  updateLoginConfig,
} from '@/services/van-blog/api';
import { ProForm, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Alert, Button, Card, message, Modal } from 'antd';
import { useState } from 'react';
export default function (props) {
  const [isrLoading, setIsrLoading] = useState(false);
  return (
    <>
      <Card title="登录安全策略">
        <ProForm
          grid={true}
          layout={'horizontal'}
          request={async (params) => {
            try {
              const { data } = await getLoginConfig();
              return { enableMaxLoginRetry: true, ...(data || {}) };
            } catch (err) {
              console.log(err);
              return { enableMaxLoginRetry: true };
            }
          }}
          syncToInitialValues={true}
          onFinish={async (data) => {
            if (location.hostname == 'blog-demo.mereith.com') {
              Modal.info({ title: '演示站禁止修改登录安全策略！' });
              return;
            }
            await updateLoginConfig(data);
            message.success('更新成功！');
          }}
        >
          <ProFormSelect
            name={'enableMaxLoginRetry'}
            label="开启最大登录失败次数限制"
            fieldProps={{
              options: [
                {
                  label: '开启',
                  value: true,
                },
                {
                  label: '关闭',
                  value: false,
                },
              ],
            }}
            placeholder="开启"
            tooltip={
              '默认开启：同一 IP 每分钟最多尝试 3 次。无论是否开启，同一 IP 10 分钟内超过 10 次登录尝试都会被暂时拒绝。'
            }
          ></ProFormSelect>
          <ProFormDigit
            name={'expiresIn'}
            label="登录凭证(Token)有效期(秒)"
            placeholder={'默认为 7 天'}
            tooltip="默认为 7 天"
          />
        </ProForm>
      </Card>

      <Card title="静态页面更新策略" style={{ marginTop: 8 }}>
        <Alert
          type="info"
          message={
            <a
              rel="noreferrer"
              target="_blank"
              href="https://vanblog.mereith.com/feature/advance/isr.html"
            >
              帮助文档
            </a>
          }
          style={{ marginBottom: 8 }}
        />
        <ProForm
          grid={true}
          layout={'horizontal'}
          request={async (params) => {
            try {
              const { data } = await getISRConfig();
              console.log(data);
              return data;
            } catch (err) {
              console.log(err);
              return {};
            }
          }}
          syncToInitialValues={true}
          onFinish={async (data) => {
            if (location.hostname == 'blog-demo.mereith.com') {
              Modal.info({ title: '演示站禁止修改静态页面更新策略！' });
              return;
            }
            await updateISRConfig(data);
            message.success('更新成功！');
          }}
        >
          <ProFormSelect
            name={'mode'}
            label="静态页面更新策略"
            fieldProps={{
              options: [
                {
                  label: '延时自动',
                  value: 'delay',
                },
                {
                  label: '按需自动',
                  value: 'onDemand',
                },
              ],
            }}
            tooltip={'默认为延时自动，使用按需自动可提高实时性，但需要更多性能（4核心以上推荐）'}
          ></ProFormSelect>
          <ProFormDigit
            name={'delay'}
            label="延时自动更新时间(秒)"
            tooltip="默认为 10 秒。表示每 10 秒，博客前台服务会尝试根据最新的后端数据来更新静态页面。"
          />
        </ProForm>
      </Card>
      <Card title="手动触发静态页面更新" style={{ marginTop: 8 }}>
        <Alert
          type="info"
          message="通常来说你不需要这样做，但某些情况下你也可以手动触发增量渲染。这会让后端尝试重新验证/渲染已知所有路由（触发完成后需要一些时间生效）。"
          style={{ marginBottom: 8 }}
        />
        <Button
          type="primary"
          onClick={async () => {
            setIsrLoading(true);
            try {
              await activeISR();
              message.success('ISR 手动触发成功！');
            } catch (err) {
              message.error('ISR 触发失败！');
            }
            setIsrLoading(false);
          }}
          loading={isrLoading}
        >
          手动触发
        </Button>
      </Card>
    </>
  );
}
