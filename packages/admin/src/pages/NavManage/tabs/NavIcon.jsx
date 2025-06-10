import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Popconfirm,
  Upload,
  Image,
  Card,
  Typography,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const NavIcon = () => {
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIcon, setEditingIcon] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 12, total: 0 });

  // 获取导航图标列表 (只获取usage为nav的图标)
  const fetchIcons = async (page = 1, pageSize = 12) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/icon?page=${page}&pageSize=${pageSize}&usage=nav`, {
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });
      const result = await response.json();
      if (result.statusCode === 200) {
        const data = result.data;
        if (data && data.icons) {
          setIcons(data.icons);
          setPagination({
            current: page,
            pageSize,
            total: data.total || 0
          });
        } else if (Array.isArray(data)) {
          setIcons(data);
          setPagination({
            current: 1,
            pageSize: data.length || 12,
            total: data.length || 0
          });
        }
      }
    } catch (error) {
      message.error('获取导航图标列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIcons();
  }, []);

  // 上传图标文件
  const uploadIcon = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const url = '/api/admin/img/upload?skipWatermark=true&skipCompress=true';
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          token: window.localStorage.getItem('token') || 'null',
        },
      });
      const data = await res.json();
      
      if (data && data.statusCode === 200) {
        return data.data.src;
      } else {
        throw new Error(data.message || '上传失败');
      }
    } catch (error) {
      throw error;
    }
  };

  // 处理图标上传
  const handleIconUpload = async (file) => {
    setUploading(true);
    try {
      // 上传图片
      const iconUrl = await uploadIcon(file);
      const iconName = file.name.split('.')[0];
      const description = `导航图标: ${file.name}`;
      
      const iconData = {
        name: iconName,
        type: 'custom',
        usage: 'nav', // 设置为导航图标
        iconUrl: iconUrl,
        description: description
      };
      
      const response = await fetch('/api/admin/icon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify(iconData),
      });
      
      if (response.ok) {
        message.success('导航图标上传成功');
        fetchIcons(pagination.current, pagination.pageSize);
      } else {
        throw new Error('创建图标记录失败');
      }
    } catch (error) {
      // 如果图标名称已存在，尝试使用带时间戳的名称重新创建
      if (error.message && error.message.includes('已存在')) {
        try {
          const timestamp = new Date().getTime().toString().slice(-6);
          const newIconName = `${file.name.split('.')[0]}_${timestamp}`;
          
          const iconData = {
            name: newIconName,
            type: 'custom',
            usage: 'nav', // 设置为导航图标
            iconUrl: await uploadIcon(file),
            description: `导航图标: ${file.name}`
          };
          
          const response = await fetch('/api/admin/icon', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': localStorage.getItem('token') || '',
            },
            body: JSON.stringify(iconData),
          });
          
          if (response.ok) {
            message.success('导航图标上传成功');
            fetchIcons(pagination.current, pagination.pageSize);
          } else {
            throw new Error('创建图标记录失败');
          }
        } catch (retryError) {
          message.error('导航图标上传失败: ' + (retryError.message || '未知错误'));
        }
      } else {
        message.error('导航图标上传失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setUploading(false);
    }
  };

  // 删除图标
  const handleDeleteIcon = async (iconName) => {
    try {
      const response = await fetch(`/api/admin/icon/${iconName}`, {
        method: 'DELETE',
        headers: {
          'token': localStorage.getItem('token') || '',
        },
      });

      if (response.ok) {
        message.success('导航图标删除成功');
        fetchIcons(pagination.current, pagination.pageSize);
      } else {
        throw new Error('删除失败');
      }
    } catch (error) {
      message.error('导航图标删除失败');
    }
  };

  // 打开编辑对话框
  const handleOpenModal = (icon = null) => {
    setEditingIcon(icon);
    setModalVisible(true);
    if (icon) {
      form.setFieldsValue({
        name: icon.name,
        description: icon.description,
      });
    } else {
      form.resetFields();
    }
  };

  // 保存图标信息
  const handleSave = async (values) => {
    try {
      const response = await fetch(`/api/admin/icon/${editingIcon.name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'token': localStorage.getItem('token') || '',
        },
        body: JSON.stringify({
          ...values,
          usage: 'nav' // 确保保持为导航图标
        }),
      });

      if (response.ok) {
        message.success('导航图标信息更新成功');
        setModalVisible(false);
        fetchIcons(pagination.current, pagination.pageSize);
      } else {
        throw new Error('更新失败');
      }
    } catch (error) {
      message.error('导航图标信息更新失败');
    }
  };

  const uploadProps = {
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件!');
        return false;
      }
      const isLt2M = file.size / 1024 / 1024 < 2;
      if (!isLt2M) {
        message.error('图片大小不能超过 2MB!');
        return false;
      }
      handleIconUpload(file);
      return false; // 阻止自动上传
    },
    showUploadList: false,
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Upload {...uploadProps}>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
            >
              上传导航图标
            </Button>
          </Upload>
          <Text type="secondary">支持 JPG、PNG、SVG 等格式，大小不超过 2MB</Text>
        </Space>
      </div>

      <div style={{ 
        padding: 16, 
        background: '#f5f5f5', 
        borderRadius: 8,
        marginBottom: 16,
        textAlign: 'center'
      }}>
        <Text type="secondary">
          这里的图标专用于导航工具管理，与社交链接的图标管理是独立的
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {icons.map((icon) => (
          <Col key={icon.name} xs={24} sm={12} md={8} lg={6} xl={4}>
            <Card
              hoverable
              cover={
                <div style={{ 
                  height: 120, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: '#fafafa'
                }}>
                  <Image
                    src={icon.iconUrl}
                    alt={icon.name}
                    width={64}
                    height={64}
                    style={{ objectFit: 'contain' }}
                    preview={false}
                    fallback="/default-icon.png"
                  />
                </div>
              }
              actions={[
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenModal(icon)}
                >
                  编辑
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确定要删除这个导航图标吗？"
                  onConfirm={() => handleDeleteIcon(icon.name)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                title={icon.name}
                description={
                  <div>
                    <div style={{ 
                      color: '#666', 
                      fontSize: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {icon.description || '无描述'}
                    </div>
                    <div style={{ 
                      color: '#999', 
                      fontSize: '11px',
                      marginTop: 4
                    }}>
                      {new Date(icon.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {icons.length === 0 && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 0',
          color: '#999'
        }}>
          暂无导航图标，点击上传按钮添加图标
        </div>
      )}

      <div style={{ 
        marginTop: 24, 
        textAlign: 'center',
        borderTop: '1px solid #f0f0f0',
        paddingTop: 16
      }}>
        <Button
          onClick={() => fetchIcons(pagination.current, pagination.pageSize)}
          loading={loading}
        >
          刷新
        </Button>
        <Text style={{ marginLeft: 16, color: '#666' }}>
          共 {pagination.total} 个导航图标
        </Text>
      </div>

      <Modal
        title="编辑导航图标信息"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="图标名称"
            rules={[{ required: true, message: '请输入图标名称' }]}
          >
            <Input placeholder="请输入图标名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="请输入图标描述" />
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

export default NavIcon; 