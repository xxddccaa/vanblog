import { useState, useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { ActionType, ProTable } from '@ant-design/pro-table';
import { Button, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { deleteMoment, getMoments } from '@/services/van-blog/api';
import { checkDemo } from '@/services/van-blog/check';
import moment from 'moment';
import 'moment/locale/zh-cn';
import { history } from 'umi';

// 配置 moment 中文语言
moment.locale('zh-cn');

export default function MomentManage() {
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
            display: '-webkit-box',
            WebkitLineClamp: 10,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '400px',
            lineHeight: '1.5'
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

  const handleCreate = () => {
    // 跳转到编辑器页面创建新动态
    history.push('/editor?type=moment');
  };

  const handleEdit = (record) => {
    // 跳转到编辑器页面编辑动态
    history.push(`/editor?type=moment&id=${record.id}`);
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
            onClick={handleCreate}
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
    </PageContainer>
  );
} 