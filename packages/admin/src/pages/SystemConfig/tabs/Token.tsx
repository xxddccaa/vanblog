import AdminMobileCardList from '@/components/AdminMobileCardList';
import { createApiToken, getAllApiTokens, deleteApiToken } from '@/services/van-blog/api';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ActionType } from '@ant-design/pro-components';
import { Button, Card, Space, Tag, Typography, message, Modal } from 'antd';

import { useEffect, useRef, useState } from 'react';
const columns = [
  { dataIndex: '_id', title: 'ID' },
  { dataIndex: 'name', title: '名称' },
  {
    dataIndex: 'token',
    title: '内容',
    render: (token) => {
      return (
        <Typography.Text style={{ maxWidth: 250 }} ellipsis={true} copyable={true}>
          {token}
        </Typography.Text>
      );
    },
  },
  {
    title: '操作',
    render: (text, record, _, action) => [
      <a
        key="delete"
        style={{ marginLeft: 8 }}
        onClick={() => {
          Modal.confirm({
            title: '删除确认',
            content: '是否确认删除该 Token？',
            onOk: async () => {
              await deleteApiToken(record._id);
              action?.reload();
              message.success('删除成功！');
            },
          });
        }}
      >
        删除
      </a>,
    ],
  },
];
export default function () {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef<ActionType>();
  const [tokens, setTokens] = useState<any[]>([]);

  const fetchTokens = async () => {
    const { data } = await getAllApiTokens();
    setTokens(data || []);
    return data;
  };

  useEffect(() => {
    if (!mobile) {
      return;
    }
    fetchTokens();
  }, [mobile]);

  return (
    <>
      <Card
        title="Token 管理"
        style={{ marginTop: 8 }}
        className="card-body-full"
        extra={
          <Space>
            <ModalForm
              title="新建 API Token"
              trigger={<Button type="primary"> 新建</Button>}
              onFinish={async (vals) => {
                await createApiToken(vals);
                actionRef.current?.reload();
                fetchTokens();
                return true;
              }}
            >
              <ProFormText label="名称" name="name" />
            </ModalForm>
            <Button
              onClick={() => {
                window.open('/swagger', '_blank');
              }}
            >
              API 文档
            </Button>
            <Button
              onClick={() => {
                Modal.info({
                  title: 'Token 管理功能介绍',
                  content: (
                    <div>
                      <p>创建的 Api Token 可以用来调用 VanBlog 的 API</p>
                      <p>结合 API 文档，您可以做到很多有意思的事情。</p>
                      <p>API 文档现在比较水，会慢慢完善的，未来会有 API Playgroud，敬请期待。</p>
                      <p>
                        PS：暂时没必要通过 API
                        开发自己的前台，后面会出主题功能（完善的文档和开发指南，不限制技术栈），届时再开发会更好。
                      </p>
                      <p>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://vanblog.mereith.com/advanced/token.html"
                        >
                          相关文档
                        </a>
                      </p>
                    </div>
                  ),
                });
              }}
            >
              帮助
            </Button>
          </Space>
        }
      >
        {mobile ? (
          <div style={{ padding: 14 }}>
            <AdminMobileCardList
              items={tokens}
              rowKey="_id"
              emptyText="暂无 Token"
              renderCard={(record) => (
                <Card className="admin-mobile-record-card">
                  <div className="admin-mobile-record-title-row">
                    <div className="admin-mobile-record-title">{record.name}</div>
                    <Tag>ID {record._id}</Tag>
                  </div>
                  <div className="admin-mobile-record-copy" style={{ marginBottom: 0 }}>
                    <Typography.Text copyable>{record.token}</Typography.Text>
                  </div>
                  <div className="admin-mobile-record-actions">
                    <Button
                      danger
                      onClick={() => {
                        Modal.confirm({
                          title: '删除确认',
                          content: '是否确认删除该 Token？',
                          onOk: async () => {
                            await deleteApiToken(record._id);
                            await fetchTokens();
                            message.success('删除成功！');
                          },
                        });
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </Card>
              )}
            />
          </div>
        ) : (
          <ProTable
            rowKey="id"
            columns={columns}
            dateFormatter="string"
            actionRef={actionRef}
            search={false}
            options={false}
            pagination={{
              hideOnSinglePage: true,
              simple: mobile,
            }}
            request={async () => {
              let data = await fetchTokens();
              return {
                data,
                success: true,
                total: data.length,
              };
            }}
          />
        )}
      </Card>
    </>
  );
}
