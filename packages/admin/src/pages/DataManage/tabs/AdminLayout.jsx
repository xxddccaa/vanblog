import { EyeOutlined, EyeInvisibleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { Button, Card, Table, Modal, Form, Input, Space, message, Tooltip } from 'antd';
import { useState, useEffect, useCallback } from 'react';
import { getAdminLayoutConfig, updateAdminLayoutConfig } from '@/services/van-blog/api';

export default function AdminLayout() {
  const [loading, setLoading] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // 获取配置数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAdminLayoutConfig();
      if (data && data.menuItems) {
        const sortedItems = [...data.menuItems].sort((a, b) => a.order - b.order);
        setMenuItems(sortedItems);
      }
    } catch (error) {
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存配置
  const handleSave = async () => {
    setLoading(true);
    try {
      await updateAdminLayoutConfig({ menuItems });
      message.success('保存成功，请刷新页面查看效果');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 上移
  const moveUp = (index) => {
    if (index > 0) {
      const newItems = [...menuItems];
      [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
      // 更新order
      const reorderedItems = newItems.map((item, idx) => ({ ...item, order: idx }));
      setMenuItems(reorderedItems);
    }
  };

  // 下移
  const moveDown = (index) => {
    if (index < menuItems.length - 1) {
      const newItems = [...menuItems];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      // 更新order
      const reorderedItems = newItems.map((item, idx) => ({ ...item, order: idx }));
      setMenuItems(reorderedItems);
    }
  };

  // 切换可见性
  const toggleVisible = (key) => {
    setMenuItems(items =>
      items.map(item =>
        item.key === key ? { ...item, visible: !item.visible } : item
      )
    );
  };

  // 编辑菜单项
  const handleEdit = (item) => {
    setEditingItem(item);
    form.setFieldsValue({ name: item.name });
    setModalVisible(true);
  };

  // 提交编辑
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        setMenuItems(items =>
          items.map(item =>
            item.key === editingItem.key ? { ...item, name: values.name } : item
          )
        );
      }
      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
    } catch (error) {
      // 验证失败
    }
  };

  // 取消编辑
  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingItem(null);
    form.resetFields();
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      title: '排序',
      dataIndex: 'order',
      align: 'center',
      render: (_, __, index) => (
        <Space>
          <span style={{ minWidth: '20px', display: 'inline-block' }}>{index + 1}</span>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={() => moveUp(index)}
            disabled={index === 0}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={() => moveDown(index)}
            disabled={index === menuItems.length - 1}
          />
        </Space>
      ),
    },
    {
      title: '菜单名称',
      dataIndex: 'name',
      render: (text, record) => (
        <span style={{ textDecoration: !record.visible ? 'line-through' : 'none' }}>
          {text}
        </span>
      ),
    },
    {
      title: '原始名称',
      dataIndex: 'originalName',
      render: (text) => <span style={{ color: '#999' }}>{text}</span>,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      align: 'center',
      render: (icon) => <code>{icon}</code>,
    },
    {
      title: '路径',
      dataIndex: 'path',
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>,
    },
    {
      title: '可见性',
      dataIndex: 'visible',
      align: 'center',
      render: (visible, record) => (
        <Tooltip title={visible ? '点击隐藏' : '点击显示'}>
          <Button
            type="text"
            icon={visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={() => toggleVisible(record.key)}
            style={{ color: visible ? '#52c41a' : '#ff4d4f' }}
          />
        </Tooltip>
      ),
    },
    {
      title: '操作',
      align: 'center',
      render: (_, record) => (
        <Button type="link" onClick={() => handleEdit(record)}>
          编辑名称
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="后台布局管理"
        extra={
          <Space>
            <Button onClick={fetchData} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={handleSave} loading={loading}>
              保存配置
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#666', fontSize: '14px' }}>
            • 点击上移/下移按钮可以调整菜单顺序<br />
            • 点击眼睛图标可以切换菜单的显示/隐藏<br />
            • 点击"编辑名称"可以修改菜单显示名称<br />
            • 修改后需要手动刷新页面才能看到效果
          </div>
        </div>

        <Table
          dataSource={menuItems}
          columns={columns}
          rowKey="key"
          pagination={false}
          loading={loading}
          size="small"
        />
      </Card>

      <Modal
        title="编辑菜单名称"
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={400}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="请输入菜单显示的名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
} 