import { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Button, Space, message, Modal, Input, Table, Tag, Tooltip } from 'antd';
import { 
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { history } from 'umi';
import moment from 'moment';
import { 
  getMindMaps,
  createMindMap,
  deleteMindMap,
  searchMindMap,
} from '@/services/van-blog/api';
import './index.less';

export default function MindMap() {
  const [loading, setLoading] = useState(false);
  const [mindMaps, setMindMaps] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMindMapTitle, setNewMindMapTitle] = useState('');
  const [newMindMapDesc, setNewMindMapDesc] = useState('');
  const [searchValue, setSearchValue] = useState('');

  // 加载思维导图列表
  const loadMindMaps = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const { data } = await getMindMaps({
        page: p,
        pageSize: ps,
      });
      setMindMaps(data.mindMaps || []);
      setTotal(data.total || 0);
    } catch (error) {
      message.error('加载思维导图列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadMindMaps();
  }, []);

  // 创建新思维导图
  const handleCreate = async () => {
    if (!newMindMapTitle.trim()) {
      message.error('请输入思维导图标题');
      return;
    }

    try {
      const { data } = await createMindMap({
        title: newMindMapTitle,
        description: newMindMapDesc,
        content: JSON.stringify({
          root: {
            data: {
              text: '根节点'
            },
            children: []
          },
          theme: {
            template: 'avocado',
            config: {}
          },
          layout: 'logicalStructure',
          config: {},
          view: null
        }),
      });
      
      message.success('创建成功');
      setShowCreateModal(false);
      setNewMindMapTitle('');
      setNewMindMapDesc('');
      
      // 跳转到编辑页面
      history.push(`/mindmap/editor?id=${data._id}`);
    } catch (error) {
      message.error('创建失败');
    }
  };

  // 删除思维导图
  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个思维导图吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteMindMap(id);
          message.success('删除成功');
          loadMindMaps();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 搜索
  const handleSearch = async () => {
    if (!searchValue.trim()) {
      loadMindMaps(1, pageSize);
      return;
    }

    setLoading(true);
    try {
      const { data } = await searchMindMap(searchValue);
      setMindMaps(data.data || []);
      setTotal(data.total || 0);
      setPage(1);
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: '25%',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: '10%',
    },
    {
      title: '浏览量',
      dataIndex: 'viewer',
      key: 'viewer',
      width: '10%',
      render: (viewer) => viewer || 0,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: '15%',
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => history.push(`/mindmap/editor?id=${record._id}`)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record._id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="思维导图管理"
      extra={
        <Space>
          <Input.Search
            placeholder="搜索思维导图"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 250 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowCreateModal(true)}
          >
            新建思维导图
          </Button>
        </Space>
      }
    >
      <Card>
        <Table
          loading={loading}
          columns={columns}
          dataSource={mindMaps}
          rowKey="_id"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个思维导图`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              loadMindMaps(p, ps);
            },
          }}
        />
      </Card>

      <Modal
        title="新建思维导图"
        open={showCreateModal}
        onOk={handleCreate}
        onCancel={() => {
          setShowCreateModal(false);
          setNewMindMapTitle('');
          setNewMindMapDesc('');
        }}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 8 }}>标题 *</div>
            <Input
              placeholder="请输入思维导图标题"
              value={newMindMapTitle}
              onChange={(e) => setNewMindMapTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>描述</div>
            <Input.TextArea
              placeholder="请输入思维导图描述（可选）"
              value={newMindMapDesc}
              onChange={(e) => setNewMindMapDesc(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>
        </Space>
      </Modal>
    </PageContainer>
  );
}

