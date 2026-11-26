import { createIcon, deleteIcon, getAllIcons, updateIcon } from '@/services/van-blog/api';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Image,
  Input,
  Popconfirm,
  Row,
  Table,
  Typography,
  Upload,
  message,
} from 'antd';
import { useEffect, useState } from 'react';

const { Text } = Typography;

const IconManagement = ({ onIconsChange }) => {
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // 获取图标列表
  const fetchIcons = async (page = 1, pageSize = 10) => {
    setLoading(true);
    // console.log('开始获取图标列表...', { page, pageSize });
    try {
      const response = await getAllIcons(page, pageSize);
              // console.log('图标列表API响应:', response);
      const data = response.data;
      
      if (data && data.icons) {
        // 分页数据
                  // console.log('处理分页图标数据:', data.icons);
        setIcons(data.icons || []);
        setPagination({
          current: page,
          pageSize,
          total: data.total || 0
        });
        onIconsChange && onIconsChange(data.icons || []);
      } else if (Array.isArray(data)) {
        // 全部数据
                  // console.log('处理数组图标数据:', data);
        setIcons(data);
        setPagination({
          current: 1,
          pageSize: data.length || 10,
          total: data.length || 0
        });
        onIconsChange && onIconsChange(data);
      } else {
        console.warn('图标数据格式不正确:', data);
        setIcons([]);
        setPagination({ current: 1, pageSize: 10, total: 0 });
        onIconsChange && onIconsChange([]);
      }
    } catch (error) {
      console.error('获取图标列表失败:', error);
      message.error('获取图标列表失败: ' + (error.message || '未知错误'));
      setIcons([]);
      setPagination({ current: 1, pageSize: 10, total: 0 });
      onIconsChange && onIconsChange([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('图标管理组件初始化，开始获取图标...');
    fetchIcons();
  }, []);

  // 上传图标
  const uploadIcon = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      console.log('uploadIcon - 开始上传文件:', file.name, file.type);
      
      // 所有图片都标记为跳过水印，使用原图
      let url = '/api/admin/img/upload?skipWatermark=true&skipCompress=true';
      
      console.log('uploadIcon - 发送请求:', url);
      
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          token: window.localStorage.getItem('token') || 'null',
        },
      });
      const data = await res.json();
      
      console.log('uploadIcon - 服务器响应:', data);
      
      if (data && data.statusCode === 200) {
        return data.data.src;
      } else {
        throw new Error(data.message || '上传失败');
      }
    } catch (error) {
      console.log('uploadIcon - 上传失败:', error);
      throw error;
    }
  };

  // 处理图标上传
  const handleIconUpload = async (file) => {
    setUploading(true);
    try {
      console.log('handleIconUpload - 开始处理图标上传:', file.name, '文件类型:', file.type);
      
      // 上传图片
      const iconUrl = await uploadIcon(file);
      console.log('handleIconUpload - 图标上传成功, 获取到URL:', iconUrl);
      
      const iconName = file.name.split('.')[0]; // 使用文件名作为图标名称
      const description = `上传的图标: ${file.name}`;
      
      console.log('handleIconUpload - 准备创建图标记录, 图标名称:', iconName, '图标URL:', iconUrl);
      try {
        const iconData = {
        name: iconName,
        type: 'custom',
        iconUrl: iconUrl,
          description: description
        };
        console.log('handleIconUpload - 创建图标记录数据:', iconData);
        const result = await createIcon(iconData);
        console.log('handleIconUpload - 图标记录创建结果:', result);
      
      message.success('图标上传成功');
        // 确保更新图标列表
        setTimeout(() => {
      fetchIcons(pagination.current, pagination.pageSize);
        }, 500); // 增加延迟，确保后端处理完成
      } catch (createError) {
        console.log('handleIconUpload - 创建图标记录失败:', createError);
        // 如果图标名称已存在，尝试使用带时间戳的名称重新创建
        if (createError.data && createError.data.message && createError.data.message.includes('已存在')) {
          try {
            const timestamp = new Date().getTime().toString().slice(-6);
            const newIconName = `${iconName}_${timestamp}`;
            console.log('handleIconUpload - 图标名称已存在，尝试使用新名称:', newIconName);
            const iconData = {
              name: newIconName,
              type: 'custom',
              iconUrl: iconUrl,
              description: description
            };
            const result = await createIcon(iconData);
            console.log('handleIconUpload - 使用新名称创建图标成功:', result);
            message.success(`图标上传成功 (使用名称: ${newIconName})`);
            
            // 更新图标列表
            setTimeout(() => {
              fetchIcons(pagination.current, pagination.pageSize);
            }, 500); // 增加延迟，确保后端处理完成
          } catch (retryError) {
            console.log('handleIconUpload - 重试创建图标记录失败:', retryError);
            message.error('图标上传成功但创建记录失败: ' + (retryError.message || '未知错误'));
          }
        } else {
          message.error('图标上传成功但创建记录失败: ' + (createError.message || '未知错误'));
        }
      }
    } catch (error) {
      console.log('handleIconUpload - 图标上传过程失败:', error);
      message.error('图标上传失败: ' + (error.message || '未知错误'));
    } finally {
      setUploading(false);
    }
  };

  // 删除图标
  const handleDeleteIcon = async (iconName) => {
    try {
      await deleteIcon(iconName);
      message.success('删除成功');
      fetchIcons(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败: ' + (error.message || '未知错误'));
    }
  };

  // 更新图标名称
  const handleUpdateIconName = async (oldName, newName) => {
    console.log('更新图标名称:', { oldName, newName });
    
    if (!newName || newName.trim() === '') {
      message.error('图标名称不能为空');
      return;
    }
    
    if (oldName === newName.trim()) {
      return; // 名称没有变化
    }
    
    try {
      console.log('发送更新请求:', { oldName, newName: newName.trim() });
      const response = await updateIcon(oldName, { name: newName.trim() });
      console.log('更新响应:', response);
      
      message.success('图标名称更新成功');
      
      // 刷新图标列表
      setTimeout(() => {
        fetchIcons(pagination.current, pagination.pageSize);
      }, 100);
      
    } catch (error) {
      console.error('更新图标名称失败:', error);
      message.error('更新图标名称失败: ' + (error.response?.data?.message || error.message || '未知错误'));
    }
  };

  // 图标表格列配置
  const iconColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, record, index) => {
        // 计算全局索引（考虑分页）
        const globalIndex = (pagination.current - 1) * pagination.pageSize + index + 1;
        return globalIndex;
      },
    },
    {
      title: '预览',
      dataIndex: 'iconUrl',
      key: 'preview',
      width: 80,
      render: (iconUrl, record) => (
        <Image
          src={iconUrl}
          alt={record.name}
          width={40}
          height={40}
          style={{ objectFit: 'contain' }}
          preview={false}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name, record) => (
        <Input
          key={`icon-name-${record.name}-${Date.now()}`} // 强制重新渲染
          defaultValue={name}
          size="small"
          placeholder="图标名称"
          onBlur={(e) => {
            console.log('输入框失去焦点:', { original: name, new: e.target.value });
            handleUpdateIconName(name, e.target.value);
          }}
          onPressEnter={(e) => {
            console.log('按下回车键:', { original: name, new: e.target.value });
            e.target.blur();
          }}
          style={{ 
            border: '1px solid #d9d9d9', 
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => type === 'custom' ? '自定义' : '预设',
    },
    {
      title: '图标URL',
      dataIndex: 'iconUrl',
      key: 'iconUrl',
      ellipsis: true,
      render: (url) => (
        <Text copyable={{ text: url }} style={{ fontSize: '12px' }}>
          {url.length > 50 ? url.substring(0, 50) + '...' : url}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确定删除这个图标吗？"
          onConfirm={() => handleDeleteIcon(record.name)}
          okText="确定"
          cancelText="取消"
        >
          <Button 
            type="link" 
            danger 
            size="small"
            icon={<DeleteOutlined />}
          >
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card title="图标管理" style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={16}>
            <Upload
            accept=".png,.jpg,.jpeg,.svg"
              showUploadList={false}
              beforeUpload={(file) => {
              console.log('检查文件类型:', file.type);
              const isImage = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/svg+xml';
              if (!isImage) {
                message.error('只能上传PNG、JPG/JPEG或SVG图片!');
                return false;
              }
                handleIconUpload(file);
                return false;
              }}
            >
              <Button 
                type="primary" 
                icon={<UploadOutlined />}
                loading={uploading}
              >
                上传图标
              </Button>
            </Upload>
        </Col>
      </Row>
      
      <Table
        columns={iconColumns}
        dataSource={icons}
        loading={loading}
        rowKey="name"
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: false,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 个图标`,
          onChange: (page, pageSize) => {
            fetchIcons(page, pageSize);
          }
        }}
      />
    </Card>
  );
};

export default IconManagement;
