import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Space,
  Popconfirm,
  InputNumber,
  Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { batchDeleteNavCategories } from '@/services/van-blog/batch';

const NavCategory = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 获取分类列表
  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/nav-category', {
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });
      const result = await response.json();
      if (result.statusCode === 200) {
        // 按sort字段排序
        const sortedCategories = result.data.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        setCategories(sortedCategories);
      }
    } catch (error) {
      message.error('获取分类列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量删除处理函数
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的分类');
      return;
    }
    
    try {
      await batchDeleteNavCategories(selectedRowKeys);
      message.success('批量删除成功！');
      setSelectedRowKeys([]);
      await fetchCategories();
      setTimeout(() => reorderCategories(), 500);
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  // 自动重排序所有分类
  const reorderCategories = async () => {
    try {
      const updatedCategories = categories.map((item, index) => ({
        id: item._id,
        sort: index,
      }));

      const response = await fetch('/api/admin/nav-category/sort/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify({ categories: updatedCategories }),
      });

      if (response.ok) {
        await fetchCategories(); // 重新获取数据
      }
    } catch (error) {
      console.error('重排序失败:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 计算全局索引
  const getGlobalIndex = (tableIndex, currentPage, pageSize) => {
    return (currentPage - 1) * pageSize + tableIndex;
  };

  // 打开创建/编辑对话框
  const handleOpenModal = (category = null) => {
    setEditingCategory(category);
    setModalVisible(true);
    if (category) {
      form.setFieldsValue({
        name: category.name,
        description: category.description,
        sort: category.sort,
        hide: category.hide,
      });
    } else {
      form.resetFields();
    }
  };

  // 保存分类
  const handleSave = async (values) => {
    try {
      const url = editingCategory 
        ? `/api/admin/nav-category/${editingCategory._id}`
        : '/api/admin/nav-category';
      
      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success(editingCategory ? '分类更新成功' : '分类创建成功');
        setModalVisible(false);
        await fetchCategories();
        // 如果是新建分类，自动重排序
        if (!editingCategory) {
          setTimeout(() => reorderCategories(), 500);
        }
      } else {
        throw new Error('操作失败');
      }
    } catch (error) {
      message.error(editingCategory ? '分类更新失败' : '分类创建失败');
    }
  };

  // 删除分类
  const handleDelete = async (categoryId) => {
    try {
      const response = await fetch(`/api/admin/nav-category/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });

      if (response.ok) {
        message.success('分类删除成功');
        await fetchCategories();
        // 删除后重排序
        setTimeout(() => reorderCategories(), 500);
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      message.error('分类删除失败');
    }
  };

  // 移动分类的函数 - 支持分页
  const moveCategory = async (tableIndex, direction, currentPage = 1, pageSize = 20) => {
    const globalIndex = getGlobalIndex(tableIndex, currentPage, pageSize);
    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? globalIndex - 1 : globalIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= newCategories.length) {
      return;
    }

    // 交换位置
    [newCategories[globalIndex], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[globalIndex]];
    
    // 更新排序字段
    const updatedCategories = newCategories.map((item, idx) => ({
      id: item._id,
      sort: idx,
    }));

    try {
      // 更新本地状态
      const updatedDataSource = newCategories.map((item, idx) => ({
        ...item,
        sort: idx,
      }));
      setCategories(updatedDataSource);

      // 调用API更新排序
      const response = await fetch('/api/admin/nav-category/sort/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify({ categories: updatedCategories }),
      });

      if (response.ok) {
        message.success('分类排序更新成功！');
      } else {
        throw new Error('排序更新失败');
      }
    } catch (error) {
      message.error('排序更新失败，请重试');
      // 恢复原始排序
      fetchCategories();
    }
  };

  const columns = [
    {
      title: '排序',
      key: 'sort',
      width: 120,
      render: (_, record, index) => {
        const globalIndex = getGlobalIndex(index, pagination.current, pagination.pageSize);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ minWidth: '20px' }}>{record.sort}</span>
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={globalIndex === 0}
              onClick={() => moveCategory(index, 'up', pagination.current, pagination.pageSize)}
              title="上移"
            />
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={globalIndex === categories.length - 1}
              onClick={() => moveCategory(index, 'down', pagination.current, pagination.pageSize)}
              title="下移"
            />
          </div>
        );
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || '-',
    },
    {
      title: '工具数量',
      dataIndex: 'toolCount',
      key: 'toolCount',
      width: 100,
    },
    {
      title: '是否隐藏',
      dataIndex: 'hide',
      key: 'hide',
      width: 100,
      render: (hide) => (hide ? '是' : '否'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个分类吗？"
            description="删除分类前请确保该分类下没有工具"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
          >
            添加分类
          </Button>
          <Button
            onClick={reorderCategories}
            title="重新排序所有分类，从0开始连续排序"
          >
            重新排序
          </Button>
          {selectedRowKeys.length > 0 && (
            <>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
              >
                批量删除 ({selectedRowKeys.length})
              </Button>
              <Button
                onClick={() => setSelectedRowKeys([])}
              >
                取消选择
              </Button>
            </>
          )}
        </Space>
      </div>

      {selectedRowKeys.length > 0 && (
        <Alert
          message={`已选择 ${selectedRowKeys.length} 个分类`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={categories}
        rowKey="_id"
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          preserveSelectedRowKeys: true,
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/总共 ${total} 条`,
          current: pagination.current,
          pageSize: pagination.pageSize,
          onChange: (current, pageSize) => {
            setPagination({ current, pageSize });
          },
        }}
      />

      <Modal
        title={editingCategory ? '编辑分类' : '创建分类'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ sort: 0, hide: false }}
        >
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>

          <Form.Item
            name="hide"
            label="是否隐藏"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingCategory ? '更新' : '创建'}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NavCategory; 