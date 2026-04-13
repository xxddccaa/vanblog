import {
  clearCaddyLog,
  getCaddyConfig,
  getCaddyLog,
  getHttpsConfig,
  setHttpsConfig,
} from '@/services/van-blog/api';
import ProForm, { ProFormSwitch } from '@ant-design/pro-form';
import { Alert, Button, Card, Input, message, Modal, Row, Space, Spin } from 'antd';
import lodash from 'lodash';
import { useMemo, useState } from 'react';
import { useModel } from '@umijs/max';

export default function (props) {
  const [loading, setLoading] = useState(false);
  const [curData, setCurData] = useState(null);
  const [managedByVanblog, setManagedByVanblog] = useState(false);
  const [form] = ProForm.useForm();
  const { initialState } = useModel('@@initialState');
  const cls = useMemo(() => {
    if (initialState?.settings?.navTheme != 'light') {
      return 'dark-switch';
    } else {
      return '';
    }
  }, [initialState]);
  const updateHttpsConfig = async (data) => {
    setLoading(true);
    try {
      if (!managedByVanblog) {
        message.warning('当前部署未启用 VanBlog 内置 HTTPS 管理，请在外部 Caddy 中自行配置 TLS。');
        return false;
      }
      if (data.redirect) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setTimeout(() => {
          window.location.replace(`http://${location.host}${location.pathname}`);
        }, 2000);
      }
      await setHttpsConfig(data);
      message.success('更改成功！将自动刷新至新协议');
      // let text = '关闭成功，现在可以通过 http 访问了。';
      // if (data.redirect) {
      //   text =
      //     '开启成功，现在通过 http 的访问将自动重定向到 https，这可能会导致无法通过 https + ip 访问本站。';
      // }
      // Modal.success({
      //   title: '更新成功！',
      //   content: text,
      // });
      return true;
    } catch (err) {
      message.error('更新失败！');
      return false;
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card title="HTTPS 相关配置">
      <Alert
        type="info"
        message={
          <div>
            <p>
              当前版本内置 Caddy 默认只负责反向代理，不主动接管 HTTPS/TLS。
            </p>
            <p>
              如需证书、Cloudflare DNS、自动跳转等能力，推荐在外层自行编写{' '}
              <code>Caddyfile</code> 或使用你自己的 Caddy 实例。
            </p>
            <p>
              如果你明确要让 VanBlog 内置 Caddy 接管 HTTPS，可额外开启环境变量{' '}
              <code>VAN_BLOG_CADDY_MANAGE_HTTPS=true</code>。
            </p>
            <p>
              运行日志与当前配置仍可在这里查看。底层代理仍然基于{' '}
              <a target={'_blank'} rel="noreferrer" href="https://caddyserver.com/">
                Caddy
              </a>{' '}
              。
              <a
                target={'_blank'}
                rel="noreferrer"
                href="https://vanblog.mereith.com/guide/https.html"
              >
                相关文档
              </a>
            </p>
            <p>高级玩家可点击按钮查看 Caddy 运行日志或配置排查错误。</p>
            <p>access 日志可进入容器 /var/log/vanblog-access.log 查看</p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />
      <Alert
        type="warning"
        message={
          <div>
            <p>默认情况下，此页面的 HTTPS 开关不会生效，除非显式启用内置 HTTPS 管理。</p>
            <p>
              如果你在外部又套了一层反向代理，请直接在外部代理里处理证书和 80/443 跳转。
            </p>
            <p>
              只有当你显式打开 <code>VAN_BLOG_CADDY_MANAGE_HTTPS=true</code> 时，下面的重定向配置才会实际写入内置 Caddy。
            </p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />

      <Spin spinning={loading}>
        <ProForm
          form={form}
          request={async () => {
            setLoading(true);
            try {
              const { data: res } = await getHttpsConfig();
              setLoading(false);
              if (!res) {
                setManagedByVanblog(false);
                setCurData({
                  redirect: false,
                });
                return {
                  redirect: false,
                };
              }
              setManagedByVanblog(!!res.managedByVanblog);
              setCurData(res);

              return res;
            } catch (err) {
              setLoading(false);
            }
          }}
          layout="horizontal"
          onFinish={async (data) => {
            if (location.hostname == 'blog-demo.mereith.com') {
              Modal.warning({
                title: '演示站不可修改此选项，不然怕 k8s ingress 失效',
              });
              setLoading(false);
              return;
            }
            const eq = lodash.isEqual(curData, data);

            if (eq) {
              Modal.warning({
                title: '未修改任何信息，无需保存！',
              });
              setLoading(false);
              return;
            }
            let text =
              '确定关闭 https 自动重定向吗？关闭后可通过 http 进行访问。点击确定后 2 秒将自动切换到 http 访问';
            if (data.redirect) {
              text =
                '开启 https 自动重定向之前，请确保通过域名可正常用 https 访问本站。开启将无法使用 http 访问本站。点击确定后 2 秒将自动切换到 https 访问。注意如果是自己反代了 80 端口的话，请务必不要开启此项！';
            }
            Modal.confirm({
              title: text,
              onOk: () => {
                updateHttpsConfig(data);
              },
            });
          }}
          submitter={{
            searchConfig: {
              submitText: '保存',
            },
            render: (props, doms) => {
              return (
                <>
                  <Row>
                    <Space>
                      <>{doms}</>
                      <Button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const { data: res } = await getCaddyConfig();
                            if (res) {
                              Modal.info({
                                title: 'Caddy 配置',
                                content: (
                                  <Input.TextArea
                                    autoSize={{ maxRows: 20, minRows: 15 }}
                                    value={res}
                                  />
                                ),
                              });
                            }
                          } catch (err) {
                            message.error('获取 Caddy 配置错误！');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        type="primary"
                      >
                        查看 Caddy 配置
                      </Button>
                    </Space>
                  </Row>
                  <Row style={{ marginTop: 10 }}>
                    <Space>
                      <Button
                        type="primary"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const { data: res } = await getCaddyLog();
                            if (res || res == '') {
                              Modal.info({
                                title: 'Caddy 运行日志',
                                content: (
                                  <Input.TextArea
                                    autoSize={{ maxRows: 20, minRows: 15 }}
                                    value={res}
                                  />
                                ),
                              });
                            } else {
                              message.error('获取 Caddy 日志错误！');
                            }
                          } catch (err) {
                            message.error('获取 Caddy 日志错误！');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        查看 Caddy 日志
                      </Button>
                      <Button
                        danger
                        type="primary"
                        onClick={async () => {
                          Modal.confirm({
                            title: '确定清除 Caddy 运行日志吗？清除后将无法恢复！',
                            onOk: async () => {
                              await clearCaddyLog();
                              message.success('清除 Caddy 运行日志成功！');
                            },
                          });
                        }}
                      >
                        清除 Caddy 日志
                      </Button>
                    </Space>
                  </Row>
                  <Row style={{ marginTop: 10 }}>
                    <Button
                      disabled={!managedByVanblog}
                      type="primary"
                      onClick={async () => {
                        Modal.confirm({
                          title: '触发证书按需申请',
                          content:
                            '点击确认后将打开新窗口并用 https 访问当前网址以触发证书按需申请。触发请后稍等一会（申请时间取决于网络环境），申请完成后弹出页面将通过 https 正常加载。',
                          onOk: () => {
                            window.open(`https://${window.location.host}`, '_blank');
                          },
                        });
                      }}
                    >
                      使用当前访问域名触发按需申请
                    </Button>
                  </Row>
                </>
              );
            },
          }}
        >
          <ProFormSwitch
            label="HTTPS 自动重定向"
            name="redirect"
            tooltip="开启后通过 http 访问本站将自动重定向至 https"
            disabled={!managedByVanblog}
            fieldProps={{
              className: cls,
            }}
          ></ProFormSwitch>
          {/* <ProFormSelect
            name="domains"
            mode="tags"
            disabled
            width={'lg'}
            label="自动 HTTPS 域名"
            tooltip="开启自动 HTTPS 域名，内置的 Caddy 会自动申请证书并应用"
            placeholder={'添加后，内置的 Caddy 会自动申请证书并应用'}
          /> */}
          {/* <ProFormTextArea
            disabled
            name="caddyConfig"
            label={
              <a
                href="https://picgo.github.io/PicGo-Core-Doc/zh/guide/config.html#%E8%87%AA%E5%8A%A8%E7%94%9F%E6%88%90"
                target={'_blank'}
                rel="norefferrer"
              >
                Caddy 配置
              </a>
            }
            tooltip={'内置 Caddy2 配置，不懂忽略就行'}
            placeholder="内置 Caddy2 配置，不懂忽略就行"
            fieldProps={{
              autoSize: {
                minRows: 10,
                maxRows: 30,
              },
            }}
          /> */}
        </ProForm>
      </Spin>
    </Card>
  );
}
