import { deleteTag, updateTag } from '@/services/van-blog/api';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { message, Modal, Button, Space, Tooltip, Input } from 'antd';
import { useRef, useState } from 'react';
import { SyncOutlined, SearchOutlined } from '@ant-design/icons';

const { Search } = Input;

const columns = [
  {
    dataIndex: 'name',
    title: '标签名',
    width: 200,
    ellipsis: true,
    copyable: true,
    render: (text) => (
      <Tooltip title={text}>
        <span style={{ marginLeft: 8 }}>{text}</span>
      </Tooltip>
    ),
  },
  {
    dataIndex: 'articleCount',
    title: '文章数量',
    width: 100,
    sorter: true,
    search: false,
    render: (count) => (
      <span style={{ 
        color: count > 10 ? '#1890ff' : count > 5 ? '#52c41a' : '#8c8c8c',
        fontWeight: count > 10 ? 'bold' : 'normal'
      }}>
        {count}
      </span>
    ),
  },
  {
    dataIndex: 'updatedAt',
    title: '最后更新',
    width: 180,
    valueType: 'dateTime',
    sorter: true,
    search: false,
  },
  {
    title: '操作',
    valueType: 'option',
    width: 250,
    render: (text, record, _, action) => [
      <a
        key="viewTag"
        onClick={() => {
          window.open(`/tag/${record.name.replace(/#/g, '%23')}`, '_blank');
        }}
      >
        查看
      </a>,
      <ModalForm
        key={`editTag-${record.name}`}
        title={`批量修改标签 "${record.name}"`}
        trigger={<a key={'edit-' + record.name}>批量改名</a>}
        autoFocusFirstInput
        submitTimeout={3000}
        onFinish={async (values) => {
          Modal.confirm({
            content: `确定修改标签 "${record.name}" 为 "${values.newName}" 吗？所有文章的该标签都将被更新为新名称!`,
            onOk: async () => {
              try {
                await updateTag(record.name, values.newName);
                message.success('更新成功！所有文章该标签都将变为新名称！');
                action?.reload();
              } catch (error) {
                message.error('更新失败：' + (error.message || '未知错误'));
              }
              return true;
            },
          });
          return true;
        }}
      >
        <ProFormText
          width="lg"
          name="newName"
          label="新标签"
          placeholder="请输入新的标签名称"
          tooltip="所有文章的该标签都将被更新为新名称"
          required
          rules={[{ required: true, message: '这是必填项' }]}
        />
      </ModalForm>,
      <a
        key="delTag"
        onClick={() => {
          Modal.confirm({
            title: '确认删除',
            content: `确认删除标签 "${record.name}" 吗？该标签将从所有 ${record.articleCount} 篇文章中移除。`,
            onOk: async () => {
              try {
                await deleteTag(record.name);
                message.success('删除成功！所有文章的该标签都将被删除，其他标签不变。');
                action?.reload();
              } catch (error) {
                message.error('删除失败：' + (error.message || '未知错误'));
              }
              return true;
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
  const actionRef = useRef();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/tag/sync', {
        method: 'POST',
        headers: {
          'token': localStorage.getItem('token') || '',
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      
      if (result.statusCode === 200) {
        message.success('标签数据同步成功！');
        actionRef.current?.reload();
      } else {
        message.error(result.message || '同步失败');
      }
    } catch (error) {
      message.error('同步失败：' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const fetchData = async (params = {}) => {
    try {
      const { current = 1, pageSize = 50, ...searchParams } = params;
      
      // 构建查询参数
      const queryParams = new URLSearchParams({
        page: current.toString(),
        pageSize: pageSize.toString(),
        sortBy: 'articleCount',
        sortOrder: 'desc',
      });

      // 添加搜索关键词
      if (searchKeyword) {
        queryParams.append('search', searchKeyword);
      }

      // 处理排序
      if (searchParams.articleCount) {
        queryParams.set('sortBy', 'articleCount');
        queryParams.set('sortOrder', searchParams.articleCount === 'ascend' ? 'asc' : 'desc');
      }
      if (searchParams.updatedAt) {
        queryParams.set('sortBy', 'updatedAt');
        queryParams.set('sortOrder', searchParams.updatedAt === 'ascend' ? 'asc' : 'desc');
      }

      const response = await fetch(`/api/admin/tag/paginated?${queryParams}`, {
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });
      
      const result = await response.json();
      
      if (result.statusCode === 200) {
        return {
          data: result.data.tags,
          success: true,
          total: result.data.total,
        };
      } else {
        throw new Error(result.message || '获取数据失败');
      }
    } catch (error) {
      message.error('获取标签数据失败：' + error.message);
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  return (
    <>
      <ProTable
        rowKey="name"
        columns={columns}
        dateFormatter="string"
        actionRef={actionRef}
        search={false}
        options={{
          reload: true,
          density: true,
          setting: true,
        }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条/总共 ${total} 条`,
          pageSizeOptions: ['20', '50', '100', '200'],
          defaultPageSize: 50,
        }}
        request={fetchData}
        toolbar={{
          title: (
            <Space>
              <span>标签管理</span>
              <Search
                placeholder="搜索标签名称"
                allowClear
                enterButton={<SearchOutlined />}
                style={{ width: 300 }}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={() => actionRef.current?.reload()}
              />
            </Space>
          ),
          actions: [
            <Button
              key="sync"
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              loading={syncing}
              onClick={handleSync}
            >
              同步标签数据
            </Button>,
          ],
        }}
        scroll={{ x: 'max-content' }}
      />
    </>
  );
}
