import AdminMobileCardList from '@/components/AdminMobileCardList';
import CollaboratorModal, { getPermissionLabel } from '@/components/CollaboratorModal';
import Tags from '@/components/Tags';
import { deleteCollaborator, getAllCollaborators, updateUser } from '@/services/van-blog/api';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { ProForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { Button, Card, Dropdown, message, Modal, Space } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { history, useModel } from '@umijs/max';
const columns = [
  { dataIndex: 'id', title: 'ID' },
  { dataIndex: 'name', title: '用户名' },
  { dataIndex: 'nickname', title: '昵称' },
  {
    dataIndex: 'permissions',
    title: '权限',
    render: (data) => {
      return (
        <Tags
          tags={data.map((t) => {
            return getPermissionLabel(t);
          })}
        />
      );
    },
  },
  {
    title: '操作',
    render: (text, record, _, action) => [
      <CollaboratorModal
        initialValues={record}
        id={record.id}
        key="edit"
        onFinish={() => {
          action?.reload();
          message.success('修改协作者成功！');
        }}
        trigger={<a>修改</a>}
      />,
      <a
        key="delete"
        style={{ marginLeft: 8 }}
        onClick={() => {
          Modal.confirm({
            title: '删除确认',
            content: '是否确认删除该协作者？',
            onOk: async () => {
              await deleteCollaborator(record.id);
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
  const { initialState, setInitialState } = useModel('@@initialState');
  const actionRef = useRef();
  const [collaborators, setCollaborators] = useState([]);

  const fetchCollaborators = async () => {
    const { data } = await getAllCollaborators();
    setCollaborators(data || []);
    return data;
  };

  useEffect(() => {
    if (!mobile) {
      return;
    }
    fetchCollaborators();
  }, [mobile]);

  const handleDeleteCollaborator = (record) => {
    Modal.confirm({
      title: '删除确认',
      content: '是否确认删除该协作者？',
      onOk: async () => {
        await deleteCollaborator(record.id);
        await fetchCollaborators();
        message.success('删除成功！');
      },
    });
  };

  return (
    <>
      <Card title="用户设置">
        <ProForm
          grid={true}
          layout={mobile ? 'vertical' : 'horizontal'}
          labelCol={mobile ? undefined : { span: 6 }}
          request={async (params) => {
            return {
              name: initialState?.user?.name || '',
              password: initialState?.user?.password || '',
            };
          }}
          syncToInitialValues={true}
          onFinish={async (data) => {
            await updateUser({
              name: data.name,
              password: encryptPwd(data.name, data.password),
            });
            window.localStorage.removeItem('token');
            setInitialState((s) => ({ ...s, user: undefined }));
            history.push('/');
            message.success('更新用户成功！请重新登录！');
          }}
        >
          <ProFormText
            width="lg"
            name="name"
            required={true}
            rules={[{ required: true, message: '这是必填项' }]}
            label="登录用户名"
            placeholder={'请输入登录用户名'}
          />
          {/* <ProFormText
            width="lg"
            name="nickname"
            required={true}
            rules={[{ required: true, message: '这是必填项' }]}
            label="昵称"
            placeholder={'请输入昵称（显示的名字）'}
          ></ProFormText> */}
          <ProFormText.Password
            width="lg"
            name="password"
            required={true}
            rules={[{ required: true, message: '这是必填项' }]}
            autocomplete="new-password"
            label="登录密码"
            placeholder={'请输入登录密码'}
          />
        </ProForm>
      </Card>
      <Card
        title="协作者"
        style={{ marginTop: 8 }}
        className="card-body-full"
        extra={
          <Space>
            <CollaboratorModal
              onFinish={() => {
                message.success('新建协作者成功！');
                actionRef.current?.reload();
                fetchCollaborators();
              }}
              trigger={<Button type="primary">新建</Button>}
            />
            <Button
              onClick={() => {
                Modal.info({
                  title: '协作者功能',
                  content: (
                    <div>
                      <p>
                        <span>您可以添加一些具有指定权限的协作者用户。</span>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://vanblog.mereith.com/feature/advance/collaborator.html"
                        >
                          帮助文档
                        </a>
                      </p>
                      <p>
                        协作者默认具有文章、草稿、图片的查看/上传权限；私密文档访问需显式授予文档权限。
                      </p>
                      <p>
                        协作者登录后将看到被精简的后台页面；即使授予“所有权限”，Token、备份恢复、Caddy、系统设置、自定义页面、流水线等系统级接口仍仅超管可用。
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
              items={collaborators}
              rowKey="id"
              emptyText="暂无协作者"
              renderCard={(record) => (
                <Card className="admin-mobile-record-card">
                  <div className="admin-mobile-record-title-row">
                    <div className="admin-mobile-record-title">
                      {record.nickname || record.name}
                    </div>
                  </div>
                  <div className="admin-mobile-record-meta">
                    <span>ID {record.id}</span>
                    <span>用户名 {record.name}</span>
                  </div>
                  <Tags tags={(record.permissions || []).map((item) => getPermissionLabel(item))} />
                  <div className="admin-mobile-record-actions">
                    <CollaboratorModal
                      initialValues={record}
                      id={record.id}
                      onFinish={() => {
                        fetchCollaborators();
                        message.success('修改协作者成功！');
                      }}
                      trigger={<Button type="primary">修改</Button>}
                    />
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'delete',
                            label: '删除',
                            danger: true,
                            onClick: () => handleDeleteCollaborator(record),
                          },
                        ],
                      }}
                    >
                      <Button icon={<MoreOutlined />}>更多</Button>
                    </Dropdown>
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
              simple: true,
            }}
            request={async () => {
              let data = await fetchCollaborators();
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
