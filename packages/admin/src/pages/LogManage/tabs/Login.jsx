import AdminMobileCardList from '@/components/AdminMobileCardList';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { getLog } from '@/services/van-blog/api';
import { ProTable } from '@ant-design/pro-components';
import { Card, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';

const columns = [
  {
    title: '序号',
    align: 'center',
    width: 50,
    render: (text, record, index) => {
      return index + 1;
    },
  },
  {
    title: '登录时间',
    dataIndex: 'time',
    key: 'time',
    align: 'center',
    render: (text, record) => {
      return new Date(record.time).toLocaleString();
    },
  },
  {
    title: '登录地址',
    dataIndex: 'address',
    key: 'address',
    align: 'center',
  },
  {
    title: '登录IP',
    dataIndex: 'ip',
    key: 'ip',
    align: 'center',
  },
  {
    title: '登录设备',
    dataIndex: 'platform',
    key: 'platform',
    align: 'center',
  },
  {
    title: '登录状态',
    dataIndex: 'success',
    key: 'success',
    align: 'center',
    render: (text, record) => {
      return (
        <Tag color={record.success ? 'success' : 'error'} style={{ marginRight: 0 }}>
          {record.success ? '成功' : '失败'}
        </Tag>
      );
    },
  },
];
export default function () {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await getLog('login', 1, 20);
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

  return (
    <>
      {mobile ? (
        <AdminMobileCardList
          items={items}
          loading={loading}
          rowKey="time"
          emptyText="暂无登录日志"
          renderCard={(record) => (
            <Card className="admin-mobile-record-card">
              <div className="admin-mobile-record-title-row">
                <div className="admin-mobile-record-title">{record.address || '未知地址'}</div>
                <Tag color={record.success ? 'success' : 'error'}>
                  {record.success ? '成功' : '失败'}
                </Tag>
              </div>
              <div className="admin-mobile-record-meta">
                <span>{new Date(record.time).toLocaleString()}</span>
                <span>{record.ip}</span>
              </div>
              <div className="admin-mobile-record-copy" style={{ marginBottom: 0 }}>
                登录设备：{record.platform || '-'}
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
          options={true}
          headerTitle="登录日志"
          pagination={{
            pageSize: 10,
            simple: true,
            hideOnSinglePage: true,
          }}
          request={async (params) => {
            const { data } = await getLog('login', params.current, params.pageSize);
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
