import AdminMobileCardList from '@/components/AdminMobileCardList';
import TipTitle from '@/components/TipTitle';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { PageContainer } from '@ant-design/pro-layout';
import ProTable from '@ant-design/pro-table';
import { Button, Card, Dropdown, message, Modal, Space, Tag } from 'antd';
import { getPiplelines, getPipelineConfig, deletePipelineById } from '@/services/van-blog/api';
import PipelineModal from './components/PipelineModal';
import { useEffect, useRef, useState } from 'react';
import { history } from '@umijs/max';
import { MoreOutlined } from '@ant-design/icons';

export default function () {
  const { mobile } = useAdminResponsive();
  const [pipelineConfig, setPipelineConfig] = useState<any[]>([]);
  const actionRef = useRef<any>();
  const [mobilePipelines, setMobilePipelines] = useState<any[]>([]);
  const [mobileLoading, setMobileLoading] = useState(false);

  useEffect(() => {
    getPipelineConfig().then(({ data }) => {
      setPipelineConfig(data);
    });
  }, []);

  const fetchPipelines = async () => {
    setMobileLoading(true);
    try {
      const data = await getPiplelines();
      setMobilePipelines(data?.data || []);
    } finally {
      setMobileLoading(false);
    }
  };

  useEffect(() => {
    if (!mobile) {
      return;
    }
    fetchPipelines();
  }, [mobile]);

  const columns = [
    {
      dataIndex: 'id',
      valueType: 'number',
      title: 'ID',
      width: 48,
    },
    {
      dataIndex: 'name',
      valueType: 'text',
      title: '名称',
      width: 120,
    },
    {
      title: '是否异步',
      width: 60,
      render: (_, record) => {
        const passive = pipelineConfig.find((item) => item.eventName === record.eventName)?.passive;
        return <Tag children={passive ? '异步' : '阻塞'} color={passive ? 'green' : 'red'} />;
      },
    },
    {
      dataIndex: 'eventName',
      valueType: 'text',
      title: '触发事件',
      width: 120,
      render: (eventName) => {
        return pipelineConfig.find((item) => item.eventName === eventName)?.eventNameChinese;
      },
    },
    {
      dataIndex: 'enabled',
      title: '状态',
      width: 60,
      render: (enabled: boolean) => (
        <Tag children={enabled ? '启用' : '禁用'} color={enabled ? 'green' : 'gray'} />
      ),
    },
    {
      title: '操作',
      width: 180,
      render: (_, record, action) => {
        return (
          <>
            <Space>
              <a
                onClick={() => {
                  history.push('/code?type=pipeline&id=' + record.id);
                }}
              >
                编辑脚本
              </a>
              <PipelineModal
                mode="edit"
                trigger={<a>修改信息</a>}
                initialValues={record}
                onFinish={() => {
                  actionRef.current?.reload();
                }}
              />

              <a
                onClick={async () => {
                  Modal.confirm({
                    title: '确定删除该流水线吗？ ',
                    onOk: async () => {
                      await deletePipelineById(record.id);
                      console.log(action);
                      actionRef.current.reload();
                      message.success('删除成功！');
                    },
                  });
                }}
              >
                删除
              </a>
            </Space>
          </>
        );
      },
    },
  ];

  return (
    <PageContainer
      header={{
        title: (
          <TipTitle title="流水线" tip="流水线允许用户在特定事件时，自动触发执行自定义代码。" />
        ),
      }}
      extra={
        <Button
          onClick={() => {
            window.open('https://vanblog.mereith.com/features/pipeline.html', '_blank');
          }}
        >
          帮助文档
        </Button>
      }
    >
      {mobile ? (
        <>
          <Card className="admin-mobile-toolbar-card">
            <Space wrap style={{ width: '100%' }}>
              <PipelineModal
                mode="create"
                trigger={<Button type="primary">新建</Button>}
                onFinish={() => {
                  fetchPipelines();
                }}
              />
              <Button
                onClick={() => {
                  history.push('/site/log?tab=pipeline');
                }}
              >
                运行日志
              </Button>
            </Space>
          </Card>
          <AdminMobileCardList
            items={mobilePipelines}
            loading={mobileLoading}
            rowKey="id"
            emptyText="暂无流水线"
            renderCard={(record) => {
              const currentConfig = pipelineConfig.find(
                (item) => item.eventName === record.eventName,
              );
              const passive = currentConfig?.passive;
              return (
                <Card className="admin-mobile-record-card">
                  <div className="admin-mobile-record-title-row">
                    <div className="admin-mobile-record-title">{record.name}</div>
                    <Tag color={record.enabled ? 'green' : 'default'}>
                      {record.enabled ? '启用' : '禁用'}
                    </Tag>
                  </div>
                  <Space wrap>
                    <Tag color="blue">{currentConfig?.eventNameChinese || record.eventName}</Tag>
                    <Tag color={passive ? 'green' : 'red'}>{passive ? '异步' : '阻塞'}</Tag>
                  </Space>
                  <div className="admin-mobile-record-actions">
                    <Button
                      type="primary"
                      onClick={() => {
                        history.push('/code?type=pipeline&id=' + record.id);
                      }}
                    >
                      编辑脚本
                    </Button>
                    <PipelineModal
                      mode="edit"
                      trigger={<Button>修改信息</Button>}
                      initialValues={record}
                      onFinish={() => {
                        fetchPipelines();
                      }}
                    />
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'delete',
                            label: '删除',
                            danger: true,
                            onClick: () => {
                              Modal.confirm({
                                title: '确定删除该流水线吗？',
                                onOk: async () => {
                                  await deletePipelineById(record.id);
                                  fetchPipelines();
                                  message.success('删除成功！');
                                },
                              });
                            },
                          },
                        ],
                      }}
                    >
                      <Button icon={<MoreOutlined />}>更多</Button>
                    </Dropdown>
                  </div>
                </Card>
              );
            }}
          />
        </>
      ) : (
        <ProTable
          actionRef={actionRef}
          pagination={{
            hideOnSinglePage: true,
          }}
          toolBarRender={(action) => {
            return [
              <PipelineModal
                mode="create"
                key="createPipelineBtn1"
                trigger={<Button type="primary">新建</Button>}
                onFinish={() => {
                  action.reload();
                }}
              />,
              <Button
                key="viewLog"
                onClick={() => {
                  history.push('/site/log?tab=pipeline');
                }}
              >
                运行日志
              </Button>,
            ];
          }}
          headerTitle="流水线列表"
          columns={columns}
          search={false}
          rowKey="id"
          request={async () => {
            const data = await getPiplelines();
            return {
              data: data.data,
              success: true,
              total: data.data.length,
            };
          }}
        />
      )}
    </PageContainer>
  );
}
