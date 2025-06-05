import { useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { ActionType, ProTable } from '@ant-design/pro-table';
import { Button, message, Popconfirm, Modal, Input } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { deleteMoment, getMoments, createMoment, updateMoment } from '@/services/van-blog/api';
import { checkDemo } from '@/services/van-blog/check';
import moment from 'moment';
import 'moment/locale/zh-cn';

// 配置 moment 中文语言
moment.locale('zh-cn');

const { TextArea } = Input;

export default function MomentManage() {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentMoment, setCurrentMoment] = useState(null);
  const [newContent, setNewContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const actionRef = useRef();

  const formatTime = (dateString) => {
    try {
      return moment(dateString).fromNow();
    } catch {
      return dateString;
    }
  };

  const columns = [
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
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '400px'
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
          <div style={{ fontSize: '12px', color: '#999' }}>
            {formatTime(text)}
          </div>
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
          <div style={{ fontSize: '12px', color: '#999' }}>
            {formatTime(text)}
          </div>
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
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const handleCreate = async () => {
    if (!newContent.trim()) {
      message.error('动态内容不能为空');
      return;
    }

    if (!checkDemo()) return;

    setLoading(true);
    try {
      await createMoment({ content: newContent.trim() });
      message.success('创建成功');
      setCreateModalVisible(false);
      setNewContent('');
      actionRef.current?.reload();
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setCurrentMoment(record);
    setEditContent(record.content);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      message.error('动态内容不能为空');
      return;
    }

    if (!checkDemo()) return;

    setLoading(true);
    try {
      await updateMoment(currentMoment.id, { content: editContent.trim() });
      message.success('更新成功');
      setEditModalVisible(false);
      setCurrentMoment(null);
      setEditContent('');
      actionRef.current?.reload();
    } catch (error) {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!checkDemo()) return;

    try {
      await deleteMoment(id);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('删除失败');
    }
  };

  return (
    <PageContainer
      title="动态管理"
      content="管理个人动态内容"
    >
      <ProTable
        headerTitle="动态列表"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setNewContent('');
              setCreateModalVisible(true);
            }}
          >
            发布动态
          </Button>,
        ]}
        request={async (params, sort) => {
          try {
            const { current = 1, pageSize = 200 } = params;
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
          defaultPageSize: 200,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100', '200'],
        }}
      />

      {/* 创建动态弹窗 */}
      <Modal
        title="发布动态"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          setNewContent('');
        }}
        confirmLoading={loading}
        okText="发布"
        cancelText="取消"
        width={600}
      >
        <TextArea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="分享一下你的想法..."
          rows={6}
          showCount
          maxLength={2000}
        />
      </Modal>

      {/* 编辑动态弹窗 */}
      <Modal
        title="编辑动态"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentMoment(null);
          setEditContent('');
        }}
        confirmLoading={loading}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <TextArea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="分享一下你的想法..."
          rows={6}
          showCount
          maxLength={2000}
        />
      </Modal>
    </PageContainer>
  );
} 