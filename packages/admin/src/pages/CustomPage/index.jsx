import AdminMobileCardList from '@/components/AdminMobileCardList';
import CustomPageModal from '@/components/CustomPageModal';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { deleteCustomPageByPath, getCustomPages } from '@/services/van-blog/api';
import { ProTable } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Button, Card, Modal, Space, Tag, message } from 'antd';
import { useEffect, useRef, useState } from 'react';

const columns = [
  {
    title: '序号',
    render: (_, record, index) => {
      return index;
    },
  },
  { dataIndex: 'name', title: '名称' },
  {
    dataIndex: 'type',
    title: '类型',
    valueType: 'select',
    valueEnum: {
      file: {
        text: '单文件页面',
        status: 'Default',
      },
      folder: {
        text: '多文件页面',
        status: 'Success',
      },
    },
  },
  { dataIndex: 'path', title: '路径' },
  {
    title: '操作',
    render: (text, record) => {
      return (
        <Link
          to={
            record.type == 'file'
              ? `/code?type=file&lang=html&path=${record.path}`
              : `/code?type=folder&path=${record.path}`
          }
        >
          {record.type == 'file' ? '编辑内容' : '文件管理'}
        </Link>
      );
    },
  },
  {
    title: '路径',
    render: (text, record, _, action) => {
      return (
        <Space>
          <a key="view" target="_blank" rel="noreferrer" href={`/c${record.path}`}>
            查看
          </a>
          <CustomPageModal
            key="editInfo"
            trigger={<a>修改信息</a>}
            initialValues={record}
            onFinish={() => {
              action?.reload();
            }}
          />
          <a
            key="delete"
            onClick={() => {
              if (location.hostname == 'blog-demo.mereith.com') {
                Modal.info({
                  title: '演示站不可修改此项！',
                });
                return;
              }
              Modal.confirm({
                title: '删除确认',
                content: '是否确认删除该自定义页面？',
                onOk: async () => {
                  await deleteCustomPageByPath(record.path);
                  action?.reload();
                  message.success('删除成功！');
                },
              });
            }}
          >
            删除
          </a>
        </Space>
      );
    },
  },
];

export default function () {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef();
  const [mobilePages, setMobilePages] = useState([]);
  const [mobileLoading, setMobileLoading] = useState(false);

  const fetchPages = async () => {
    setMobileLoading(true);
    try {
      const { data } = await getCustomPages();
      setMobilePages(data || []);
    } finally {
      setMobileLoading(false);
    }
  };

  useEffect(() => {
    if (!mobile) {
      return;
    }
    fetchPages();
  }, [mobile]);

  const handleDelete = (record) => {
    if (location.hostname == 'blog-demo.mereith.com') {
      Modal.info({
        title: '演示站不可修改此项！',
      });
      return;
    }

    Modal.confirm({
      title: '删除确认',
      content: '是否确认删除该自定义页面？',
      onOk: async () => {
        await deleteCustomPageByPath(record.path);
        message.success('删除成功！');
        fetchPages();
      },
    });
  };

  const handleHelp = () => {
    Modal.info({
      title: '帮助',
      content: (
        <div>
          <p>自定义页面可以添加页面到 /c 路径下。</p>
          <p>自定义页面分为两种：单文件页面、多文件页面。</p>
          <p>
            前者可直接通过后台内置编辑器编辑其 HTML
            内容，比较省事；后者需要上传相关的文件，适合复杂页面。
          </p>
          <p>多文件页面后续会演进成“文件管理”功能。</p>
          <a
            target="_blank"
            href="https://vanblog.mereith.com/feature/advance/customPage.html"
            rel="noreferrer"
          >
            帮助文档
          </a>
        </div>
      ),
    });
  };

  return (
    <Card
      className="card-body-full"
      title="自定义页面"
      extra={
        <Space wrap>
          <CustomPageModal
            trigger={<Button type="primary">新建</Button>}
            onFinish={() => {
              actionRef.current?.reload();
              fetchPages();
              message.success('新建成功！');
            }}
          />
          <Button type="link" key="help" onClick={handleHelp}>
            帮助
          </Button>
        </Space>
      }
    >
      {mobile ? (
        <div style={{ padding: 14 }}>
          <AdminMobileCardList
            items={mobilePages}
            loading={mobileLoading}
            rowKey="_id"
            emptyText="暂无自定义页面"
            renderCard={(record) => (
              <Card className="admin-mobile-record-card">
                <div className="admin-mobile-record-title-row">
                  <div className="admin-mobile-record-title">{record.name || record.path}</div>
                  <Tag color={record.type === 'file' ? 'default' : 'green'}>
                    {record.type === 'file' ? '单文件页面' : '多文件页面'}
                  </Tag>
                </div>
                <div className="admin-mobile-record-copy">{record.path}</div>
                <div className="admin-mobile-record-actions">
                  <Button
                    type="primary"
                    onClick={() => {
                      const nextPath =
                        record.type == 'file'
                          ? `/code?type=file&lang=html&path=${record.path}`
                          : `/code?type=folder&path=${record.path}`;
                      window.location.assign(`/admin${nextPath}`);
                    }}
                  >
                    {record.type == 'file' ? '编辑内容' : '文件管理'}
                  </Button>
                  <Button href={`/c${record.path}`} target="_blank">
                    查看
                  </Button>
                  <CustomPageModal
                    trigger={<Button>修改信息</Button>}
                    initialValues={record}
                    onFinish={() => {
                      fetchPages();
                    }}
                  />
                  <Button danger onClick={() => handleDelete(record)}>
                    删除
                  </Button>
                </div>
              </Card>
            )}
          />
        </div>
      ) : (
        <ProTable
          rowKey="_id"
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
            let { data } = await getCustomPages();
            return {
              data,
              success: true,
              total: data.length,
            };
          }}
        />
      )}
    </Card>
  );
}
