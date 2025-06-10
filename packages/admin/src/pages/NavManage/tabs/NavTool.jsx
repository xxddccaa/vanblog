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
  Select,
  Image,
  Radio,
  Upload,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, LinkOutlined } from '@ant-design/icons';

const NavTool = () => {
  const [tools, setTools] = useState([]);
  const [categories, setCategories] = useState([]);
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [form] = Form.useForm();
  const [iconMode, setIconMode] = useState('auto'); // auto, custom, upload

  // 获取工具列表
  const fetchTools = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/nav-tool', {
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });
      const result = await response.json();
      if (result.statusCode === 200) {
        setTools(result.data);
      }
    } catch (error) {
      message.error('获取工具列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取分类列表
  const fetchCategories = async () => {
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
    }
  };

  // 获取图标列表
  const fetchIcons = async () => {
    try {
      const response = await fetch('/api/admin/icon?usage=nav', {
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });
      const result = await response.json();
      if (result.statusCode === 200) {
        setIcons(result.data);
      }
    } catch (error) {
      message.error('获取导航图标列表失败');
    }
  };

  useEffect(() => {
    fetchTools();
    fetchCategories();
    fetchIcons();
  }, []);

  // 打开创建/编辑对话框
  const handleOpenModal = (tool = null) => {
    setEditingTool(tool);
    setModalVisible(true);
    if (tool) {
      form.setFieldsValue({
        name: tool.name,
        url: tool.url,
        logo: tool.logo,
        categoryId: tool.categoryId,
        description: tool.description,
        sort: tool.sort,
        hide: tool.hide,
        useCustomIcon: tool.useCustomIcon,
        customIcon: tool.customIcon,
      });
      setIconMode(tool.useCustomIcon ? 'custom' : 'auto');
    } else {
      form.resetFields();
      setIconMode('auto');
    }
  };

  // 保存工具
  const handleSave = async (values) => {
    try {
      const data = {
        ...values,
        useCustomIcon: iconMode === 'custom',
      };

      const url = editingTool 
        ? `/api/admin/nav-tool/${editingTool._id}`
        : '/api/admin/nav-tool';
      
      const response = await fetch(url, {
        method: editingTool ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        message.success(editingTool ? '工具更新成功' : '工具创建成功');
        setModalVisible(false);
        fetchTools();
      } else {
        throw new Error('操作失败');
      }
    } catch (error) {
      message.error(editingTool ? '工具更新失败' : '工具创建失败');
    }
  };

  // 删除工具
  const handleDelete = async (toolId) => {
    try {
      const response = await fetch(`/api/admin/nav-tool/${toolId}`, {
        method: 'DELETE',
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });

      if (response.ok) {
        message.success('工具删除成功');
        fetchTools();
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      message.error('工具删除失败');
    }
  };

  // 获取网站图标
  const handleFetchIcon = async () => {
    const url = form.getFieldValue('url');
    if (!url) {
      message.warning('请先输入网站地址');
      return;
    }
    
    try {
      // 自动获取favicon
      const faviconUrl = `${new URL(url).origin}/favicon.ico`;
      form.setFieldsValue({ logo: faviconUrl });
      message.success('已自动获取网站图标');
    } catch (error) {
      message.error('无法获取网站图标');
    }
  };

  const columns = [
    {
      title: '图标',
      dataIndex: 'logo',
      key: 'logo',
      width: 60,
      render: (logo, record) => {
        const iconSrc = record.useCustomIcon ? record.customIcon : logo;
        return iconSrc ? (
          <Image
            src={iconSrc}
            width={32}
            height={32}
            style={{ objectFit: 'contain' }}
            fallback="/default-icon.png"
            preview={false}
          />
        ) : (
          <div style={{ width: 32, height: 32, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ?
          </div>
        );
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: false,
    },
    {
      title: '网址',
      dataIndex: 'url',
      key: 'url',
      width: 300,
      ellipsis: false,
      render: (url) => (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-all',
            lineHeight: '1.4',
            maxHeight: '2.8em'
          }}
        >
          {url}
        </a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 120,
      ellipsis: false,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: false,
      render: (text) => (
        <div
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            lineHeight: '1.4',
            maxHeight: '2.8em'
          }}
        >
          {text || '-'}
        </div>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
    },
    {
      title: '隐藏',
      dataIndex: 'hide',
      key: 'hide',
      width: 80,
      render: (hide) => (hide ? '是' : '否'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
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
            title="确定要删除这个工具吗？"
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
          添加工具
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tools}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        tableLayout="fixed"
      />

      <Modal
        title={editingTool ? '编辑工具' : '创建工具'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ sort: 0, hide: false, useCustomIcon: false }}
        >
          <Form.Item
            name="name"
            label="工具名称"
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input placeholder="请输入工具名称" />
          </Form.Item>

          <Form.Item
            name="url"
            label="网站地址"
            rules={[
              { required: true, message: '请输入网站地址' },
              { type: 'url', message: '请输入有效的网址' }
            ]}
          >
            <Input 
              placeholder="请输入网站地址 (如: https://example.com)"
              addonAfter={
                <Button
                  type="link"
                  icon={<LinkOutlined />}
                  onClick={handleFetchIcon}
                  style={{ padding: 0 }}
                >
                  获取图标
                </Button>
              }
            />
          </Form.Item>

          <Form.Item
            name="categoryId"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              {categories.map(category => (
                <Select.Option key={category._id} value={category._id}>
                  {category.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="图标设置">
            <Radio.Group value={iconMode} onChange={(e) => setIconMode(e.target.value)}>
              <Radio value="auto">自动获取</Radio>
              <Radio value="custom">自定义图标</Radio>
            </Radio.Group>
          </Form.Item>

          {iconMode === 'auto' && (
            <Form.Item
              name="logo"
              label="图标地址"
              tooltip="留空将自动尝试获取网站favicon"
            >
              <Input placeholder="图标URL (可留空自动获取)" />
            </Form.Item>
          )}

          {iconMode === 'custom' && (
            <>
              <Form.Item
                name="customIcon"
                label="自定义图标"
                tooltip="选择已上传的图标或输入图标URL"
              >
                <Select
                  placeholder="选择图标或输入URL"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  mode="combobox"
                >
                  {icons.map(icon => (
                    <Select.Option key={icon.name} value={icon.iconUrl}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img 
                          src={icon.iconUrl} 
                          alt={icon.name}
                          style={{ width: 16, height: 16, marginRight: 8 }}
                        />
                        {icon.name}
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="请输入工具描述" />
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

export default NavTool; 