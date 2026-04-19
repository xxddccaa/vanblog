import AdminMobileCardList from '@/components/AdminMobileCardList';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { getLog, getPipelineConfig } from '@/services/van-blog/api';
import { ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Card, Modal, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { history } from '@umijs/max';

export default function () {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef<ActionType>();
  const [pipelineConfig, setPipelineConfig] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    getPipelineConfig().then(({ data }) => {
      setPipelineConfig(data);
    });
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await getLog('runPipeline', 1, 20);
      setItems(data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mobile) {
      return;
    }
    fetchLogs();
  }, [mobile]);
  const columns: ProColumns<any>[] = [
    {
      title: '序号',
      align: 'center',
      width: 50,
      render: (text, record, index) => {
        return index + 1;
      },
    },
    {
      title: '流水线 id',
      dataIndex: 'pipelineId',
      key: 'pipelineId',
      align: 'center',
    },
    {
      title: '名称',
      dataIndex: 'pipelineName',
      key: 'pipelineName',
      align: 'center',
      render: (name, record) => (
        <a
          onClick={() => {
            history.push('/code?type=pipeline&id=' + record.pipelineId);
          }}
        >
          {name}
        </a>
      ),
    },
    {
      title: '触发事件',
      dataIndex: 'eventName',
      key: 'eventName',
      align: 'center',
      render: (eventName) => {
        return (
          <Tag color="blue">
            {pipelineConfig?.find((item) => item.eventName == eventName)?.eventNameChinese}
          </Tag>
        );
      },
    },
    {
      title: '结果',
      dataIndex: 'success',
      key: 'success',
      align: 'center',
      render: (success) => {
        return success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>;
      },
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      render: (_, record) => {
        return (
          <a
            onClick={() => {
              Modal.info({
                title: '详情',
                width: 800,
                content: (
                  <div
                    style={{
                      maxHeight: '60vh',
                      overflow: 'auto',
                    }}
                  >
                    <p>脚本日志：</p>
                    <pre>
                      {record.logs.map((l) => (
                        <p>{l}</p>
                      ))}
                    </pre>
                    <p>输入：</p>
                    <pre>{JSON.stringify(record.input, null, 2)}</pre>
                    <p>输出：</p>
                    <pre>{JSON.stringify(record.output, null, 2)}</pre>
                  </div>
                ),
              });
            }}
          >
            详情
          </a>
        );
      },
    },
  ];
  return (
    <>
      {mobile ? (
        <AdminMobileCardList
          items={items}
          loading={loading}
          rowKey="time"
          emptyText="暂无流水线日志"
          renderCard={(record) => (
            <Card className="admin-mobile-record-card">
              <div className="admin-mobile-record-title-row">
                <div className="admin-mobile-record-title">{record.pipelineName}</div>
                <Tag color={record.success ? 'green' : 'red'}>
                  {record.success ? '成功' : '失败'}
                </Tag>
              </div>
              <Space wrap>
                <Tag color="blue">
                  {
                    pipelineConfig?.find((item) => item.eventName == record.eventName)
                      ?.eventNameChinese
                  }
                </Tag>
                <Tag>ID {record.pipelineId}</Tag>
              </Space>
              <div className="admin-mobile-record-actions">
                <Button
                  onClick={() => {
                    history.push('/code?type=pipeline&id=' + record.pipelineId);
                  }}
                >
                  编辑脚本
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    Modal.info({
                      title: '详情',
                      width: 800,
                      content: (
                        <div
                          style={{
                            maxHeight: '60vh',
                            overflow: 'auto',
                          }}
                        >
                          <p>脚本日志：</p>
                          <pre>
                            {record.logs.map((l) => (
                              <p key={l}>{l}</p>
                            ))}
                          </pre>
                          <p>输入：</p>
                          <pre>{JSON.stringify(record.input, null, 2)}</pre>
                          <p>输出：</p>
                          <pre>{JSON.stringify(record.output, null, 2)}</pre>
                        </div>
                      ),
                    });
                  }}
                >
                  查看详情
                </Button>
              </div>
            </Card>
          )}
        />
      ) : (
        <ProTable
          cardBordered
          rowKey="time"
          columns={columns}
          search={false}
          dateFormatter="string"
          actionRef={actionRef}
          options={{ reload: true, density: true, setting: true }}
          headerTitle="流水线日志"
          pagination={{
            pageSize: 10,
            simple: true,
            hideOnSinglePage: true,
          }}
          request={async (params) => {
            const { data } = await getLog('runPipeline', params.current, params.pageSize);
            return {
              data: data.data,
              success: true,
              total: data.total,
            };
          }}
        />
      )}
    </>
  );
}
