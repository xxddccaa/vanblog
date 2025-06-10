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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const NavCategory = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();

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
        setCategories(result.data);
      }
    } catch (error) {
      message.error('获取分类列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

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
        fetchCategories();
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
        fetchCategories();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      message.error('分类删除失败');
    }
  };

  const columns = [
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
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 100,
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
        >
          添加分类
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={categories}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
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
            name="sort"
            label="排序"
            tooltip="数字越小排序越靠前"
          >
            <InputNumber min={0} style={{ width: '100%' }} />
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
                保存
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