import AdminMobileCardList from '@/components/AdminMobileCardList';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { deleteMoment, getMoments, getSiteInfo } from '@/services/van-blog/api';
import { batchDeleteMoments } from '@/services/van-blog/batch';
import { checkDemo } from '@/services/van-blog/check';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import { history } from '@umijs/max';
import { ProTable } from '@ant-design/pro-table';
import { Button, Card, Popconfirm, Space, Tag, message } from 'antd';
import moment from 'moment';
import 'moment/locale/zh-cn';
import { useEffect, useMemo, useRef, useState } from 'react';

moment.locale('zh-cn');

export default function MomentManage() {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef();
  const [defaultPageSize, setDefaultPageSize] = useState(20);
  const [mobileRows, setMobileRows] = useState([]);
  const [mobileTotal, setMobileTotal] = useState(0);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobilePageSize, setMobilePageSize] = useState(20);
  const [mobileLoading, setMobileLoading] = useState(false);

  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const { data } = await getSiteInfo();
        const configuredPageSize = data?.adminMomentPageSize || 20;
        setDefaultPageSize(configuredPageSize);
        setMobilePageSize(configuredPageSize);
      } catch (error) {
        console.error('获取站点配置失败:', error);
      }
    };
    fetchSiteInfo();
  }, []);

  const formatTime = (dateString) => {
    try {
      return moment(dateString).fromNow();
    } catch {
      return dateString;
    }
  };

  const fetchMobileMoments = async () => {
    if (!mobile) {
      return;
    }

    setMobileLoading(true);
    try {
      const response = await getMoments({
        page: mobilePage,
        pageSize: mobilePageSize,
        sortCreatedAt: 'desc',
      });

      setMobileRows(response?.data?.moments || []);
      setMobileTotal(response?.data?.total || 0);
    } catch (error) {
      message.error('加载动态失败');
    } finally {
      setMobileLoading(false);
    }
  };

  useEffect(() => {
    fetchMobileMoments();
  }, [mobile, mobilePage, mobilePageSize]);

  const handleCreate = () => {
    history.push('/editor?type=moment');
  };

  const handleEdit = (record) => {
    history.push(`/editor?type=moment&id=${record.id}`);
  };

  const handleDelete = async (id) => {
    if (!checkDemo()) {
      return;
    }

    try {
      await deleteMoment(id);
      message.success('删除成功');
      if (mobile) {
        fetchMobileMoments();
      } else {
        actionRef.current?.reload();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
        sorter: true,
      },
      {
        title: '动态内容',
        dataIndex: 'content',
        key: 'content',
        ellipsis: false,
        render: (text) => (
          <div
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 10,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxWidth: '400px',
              lineHeight: '1.5',
            }}
          >
            {text}
          </div>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (text) => (
          <div>
            <div>{new Date(text).toLocaleString('zh-CN')}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>{formatTime(text)}</div>
          </div>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (text) => (
          <div>
            <div>{new Date(text).toLocaleString('zh-CN')}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>{formatTime(text)}</div>
          </div>
        ),
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        render: (_, record) => (
          <div>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除这条动态吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [],
  );

  const mobileHeroStats = [
    { label: '总数', value: mobileTotal },
    { label: '当前页', value: mobilePage },
    { label: '每页', value: mobilePageSize },
  ];

  return (
    <PageContainer title={mobile ? false : '动态管理'}>
      {mobile ? (
        <div className="admin-mobile-section-shell">
          <Card className="admin-mobile-toolbar-card admin-mobile-hero-card">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div className="admin-mobile-toolbar-head">
                <div>
                  <div className="admin-mobile-toolbar-title">动态管理</div>
                  <div className="admin-mobile-toolbar-subtitle">
                    手机上先处理浏览、发布与进入编辑，让动态列表保持轻巧且连贯。
                  </div>
                </div>
                <div className="admin-mobile-toolbar-badge">轻量内容流</div>
              </div>
              <div className="admin-mobile-toolbar-stats">
                {mobileHeroStats.map((item) => (
                  <div key={item.label} className="admin-mobile-toolbar-stat">
                    <div className="admin-mobile-toolbar-stat-label">{item.label}</div>
                    <div className="admin-mobile-toolbar-stat-value">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="admin-mobile-action-grid admin-mobile-action-grid-single">
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  发布动态
                </Button>
              </div>
            </Space>
          </Card>
          <AdminMobileCardList
            items={mobileRows}
            loading={mobileLoading}
            rowKey="id"
            emptyText="暂无动态"
            pagination={{
              current: mobilePage,
              pageSize: mobilePageSize,
              total: mobileTotal,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100', '200'],
              onChange: (nextPage, nextPageSize) => {
                setMobilePage(nextPage);
                setMobilePageSize(nextPageSize);
              },
            }}
            renderCard={(record) => (
              <Card className="admin-mobile-record-card">
                <div className="admin-mobile-record-title-row">
                  <div className="admin-mobile-record-title">动态 #{record.id}</div>
                  <Tag color="orange">{formatTime(record.createdAt)}</Tag>
                </div>
                <div className="admin-mobile-record-copy admin-mobile-record-copy-clamp">
                  {record.content}
                </div>
                <div className="admin-mobile-record-meta">
                  <span>创建 {new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                  <span>更新 {new Date(record.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="admin-mobile-record-actions">
                  <Button type="primary" onClick={() => handleEdit(record)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定要删除这条动态吗？"
                    onConfirm={() => handleDelete(record.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button danger>删除</Button>
                  </Popconfirm>
                </div>
              </Card>
            )}
          />
        </div>
      ) : (
        <ProTable
          headerTitle="动态列表"
          actionRef={actionRef}
          rowKey="id"
          search={false}
          rowSelection={{
            fixed: true,
            preserveSelectedRowKeys: true,
          }}
          tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => {
            return (
              <Space>
                <a
                  onClick={async () => {
                    await batchDeleteMoments(selectedRowKeys);
                    message.success('批量删除成功！');
                    actionRef.current?.reload();
                    onCleanSelected();
                  }}
                >
                  批量删除
                </a>
                <a onClick={onCleanSelected}>取消选择</a>
              </Space>
            );
          }}
          toolBarRender={() => [
            <Button type="primary" key="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              发布动态
            </Button>,
          ]}
          request={async (params, sort) => {
            try {
              const { current = 1, pageSize = defaultPageSize } = params;
              const response = await getMoments({
                page: current,
                pageSize,
                sortCreatedAt: sort?.createdAt === 'ascend' ? 'asc' : 'desc',
              });

              return {
                data: response.data.moments || [],
                success: true,
                total: response.data.total || 0,
              };
            } catch (error) {
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          columns={columns}
          pagination={{
            defaultPageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100', '200'],
          }}
        />
      )}
    </PageContainer>
  );
}
