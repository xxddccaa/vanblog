import { deleteSocial, getSocial, getSocialTypes, updateSocial } from '@/services/van-blog/api';
import { getAllIcons, createIcon, deleteIcon, updateIcon } from '@/services/van-blog/api';
import { EditableProTable } from '@ant-design/pro-components';
import { 
  Modal, 
  Spin, 
  Select, 
  Button, 
  Input, 
  message, 
  Card, 
  Popconfirm,
  Upload,
  Image,
  Table,
  Row,
  Col,
  Divider,
  Space,
  Typography
} from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';

const { Option } = Select;
const { Title, Text } = Typography;

// 图标预览组件
const IconPreview = ({ iconData, size = 32 }) => {
  if (!iconData) return <span style={{ fontSize: `${size}px` }}>❓</span>;
  
  if (iconData.type === 'custom') {
    return (
      <Image
        src={iconData.iconUrl}
        alt={iconData.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain' }}
        preview={false}
      />
    );
  } else {
    // 预设图标的emoji显示
    const iconMap = {
      bilibili: '📺',
      email: '📧',
      github: '🐙',
      gitee: '🟠',
      wechat: '💬',
      'wechat-dark': '💬',
      'wechat-mp': '📱',
      weibo: '🔴',
      twitter: '🐦',
      facebook: '📘',
      instagram: '📷',
      linkedin: '💼',
      youtube: '📺',
      tiktok: '🎵',
      zhihu: '💡',
      csdn: '💻',
      juejin: '💎',
      qq: '🐧',
      telegram: '✈️',
      discord: '🎮'
    };
    return <span style={{ fontSize: `${size}px` }}>{iconMap[iconData.presetIconType] || '❓'}</span>;
  }
};

// 图标管理组件
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

export default function () {
  const [loading, setLoading] = useState(false);
  const [editableKeys, setEditableKeys] = useState([]);
  const [socialTypes, setSocialTypes] = useState([]);
  const [availableIcons, setAvailableIcons] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormData, setAddFormData] = useState({});
  const actionRef = useRef();

  const fetchData = async () => {
    try {
      console.log('开始获取社交数据...');
      const response = await getSocial();
      console.log('社交数据完整响应:', JSON.stringify(response, null, 2));
      
      let data = [];
      
      // 尝试多种可能的数据结构
      if (response?.data) {
        data = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        data = response;
      } else {
        console.warn('未知的响应格式:', response);
        data = [];
      }
      
      console.log('提取的原始数据:', data);
      
      if (!Array.isArray(data)) {
        console.error('数据不是数组格式:', data);
        return { data: [], success: false };
      }
      
      const formattedData = data.map((item, index) => {
        // 处理所有可能的字段名
        const formattedItem = {
          key: item.type || `social-${index}`,
          displayName: item.displayName || item.name || '',
          type: item.type || `item-${index}`,
          iconName: item.iconName || item.iconType || item.type || '',
          iconType: item.iconType || item.type || '',
          linkType: item.linkType || 'link',
          value: item.value || item.url || '',
          darkValue: item.darkValue || item.dark || '',
          customIconUrl: item.customIconUrl || '',
          customIconUrlDark: item.customIconUrlDark || '',
          // 保留原始数据
          ...item
        };
        console.log(`格式化项目 ${index}:`, formattedItem);
        return formattedItem;
      });
      
      console.log('最终格式化数据:', formattedData);
      
      return {
        data: formattedData,
        success: true,
        total: formattedData.length,
      };
    } catch (error) {
      console.error('获取社交数据失败:', error);
      message.error('获取社交数据失败: ' + (error.message || '未知错误'));
      return { data: [], success: false };
    }
  };

  const fetchSocialTypes = async () => {
    try {
      console.log('开始获取社交类型...');
      const response = await getSocialTypes();
      console.log('社交类型响应:', response);
      
      const data = response?.data || [];
      setSocialTypes(data);
      return data;
    } catch (error) {
      console.error('获取社交类型失败:', error);
      // 设置默认的社交类型
      const defaultTypes = [
        { label: 'GitHub', iconType: 'github' },
        { label: '邮箱', iconType: 'email' },
        { label: '微信', iconType: 'wechat' },
        { label: '微博', iconType: 'weibo' },
        { label: 'Twitter', iconType: 'twitter' },
        { label: 'Facebook', iconType: 'facebook' },
        { label: 'Instagram', iconType: 'instagram' },
        { label: 'LinkedIn', iconType: 'linkedin' },
        { label: 'YouTube', iconType: 'youtube' },
        { label: 'TikTok', iconType: 'tiktok' },
        { label: '知乎', iconType: 'zhihu' },
        { label: 'CSDN', iconType: 'csdn' },
        { label: '掘金', iconType: 'juejin' },
        { label: 'QQ', iconType: 'qq' },
        { label: 'Telegram', iconType: 'telegram' },
        { label: 'Discord', iconType: 'discord' },
      ];
      setSocialTypes(defaultTypes);
      return defaultTypes;
    }
  };

  // 处理图标变化
  const handleIconsChange = (icons) => {
    setAvailableIcons(icons);
  };

  // 生成唯一的类型标识符
  const generateUniqueTypeIdentifier = (iconType, existingData, excludeKey = null) => {
    if (!iconType) return '';
    
    // 过滤掉当前编辑的记录
    const filteredData = existingData.filter(item => item.key !== excludeKey);
    
    // 获取现有的相同类型的数量
    const existingTypes = filteredData.filter(item => 
      item.type && item.type.startsWith(iconType)
    );
    
    if (existingTypes.length === 0) {
      return iconType; // 第一个直接用类型名
    } else {
      return `${iconType}-${existingTypes.length + 1}`; // 后续加数字
    }
  };

  // 邮箱验证函数
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // URL验证函数
  const validateURL = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // 初始化获取数据
  useEffect(() => {
    fetchSocialTypes();
  }, []);

  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      width: 60,
      hideInSearch: true,
      editable: false,
      render: (_, record, index) => index + 1,
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      width: 150,
      formItemProps: () => ({
        rules: [{ required: true, message: '请输入显示名称' }],
      }),
    },

    {
      title: '图标选择',
      dataIndex: 'iconName',
      width: 150,
      valueType: 'select',
      render: (_, record) => {
        // 显示当前选择的图标
        const iconType = record.iconName || record.iconType;
        if (!iconType) return '-';
        
        // 查找对应的社交类型标签
        const socialType = socialTypes.find(type => type.iconType === iconType);
        if (socialType) {
          return socialType.label;
        }
        
        // 查找自定义图标
        const customIcon = availableIcons.find(icon => icon.name === iconType);
        if (customIcon) {
          return `${customIcon.name} (自定义)`;
        }
        
        return iconType;
      },
      fieldProps: () => ({
        placeholder: '选择图标',
        showSearch: true,
        optionFilterProp: 'label',
        options: [
          ...socialTypes.map(type => ({
            label: type.label,
            value: type.iconType,
            key: `preset-${type.iconType}`,
          })),
          ...availableIcons.map(icon => ({
            label: `${icon.name} (自定义)`,
            value: icon.name,
            key: `custom-${icon.name}`,
          }))
        ],
      }),
      formItemProps: () => ({
        rules: [{ required: true, message: '请选择图标' }],
      }),
    },
    {
      title: '自定义图标URL',
      dataIndex: 'customIconUrl',
      width: 200,
      hideInTable: true,
      dependency: ['iconName'],
      renderFormItem: (_, { record }) => {
        // 只有当选择的图标不在预设和上传图标中时才显示此字段
        const isCustom = record?.iconName && 
          !socialTypes.some(type => type.iconType === record.iconName) &&
          !availableIcons.some(icon => icon.name === record.iconName);
        
        if (!isCustom) return null;
        
        return <Input placeholder="自定义图标URL（浅色）" />;
      },
    },
    {
      title: '链接类型',
      dataIndex: 'linkType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        link: { text: '普通链接' },
        email: { text: '邮箱' },
        qrcode: { text: '二维码' },
      },
      formItemProps: () => ({
        rules: [{ required: true, message: '请选择链接类型' }],
      }),
    },
    {
      title: '链接地址',
      dataIndex: 'value',
      width: 200,
      formItemProps: () => ({
        rules: [
          { required: true, message: '请输入链接地址' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              const linkType = getFieldValue('linkType');
              if (value) {
                if (linkType === 'email' && !validateEmail(value)) {
                  return Promise.reject(new Error('请输入有效的邮箱地址'));
                }
                if (linkType === 'link' && !validateURL(value)) {
                  return Promise.reject(new Error('请输入有效的URL地址'));
                }
              }
              return Promise.resolve();
            },
          }),
        ],
      }),
      renderFormItem: (_, { record }) => {
        const linkType = record?.linkType;
        let placeholder = '请输入链接地址';
        if (linkType === 'email') {
          placeholder = '请输入邮箱地址';
        } else if (linkType === 'qrcode') {
          placeholder = '请输入二维码图片URL';
        }
        return <Input placeholder={placeholder} />;
      },
    },
    {
      title: '暗色二维码',
      dataIndex: 'darkValue',
      width: 150,
      hideInTable: true,
      dependency: ['linkType'],
      renderFormItem: (_, { record }) => {
        if (record?.linkType !== 'qrcode') {
          return null;
        }
        return <Input placeholder="暗色主题下的二维码（可选）" />;
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (text, record, _, action) => [
        <a
          key="editable"
          onClick={() => {
            action?.startEditable?.(record.key);
          }}
        >
          编辑
        </a>,
        <Popconfirm
          key="delete"
          title="确定删除吗？"
          onConfirm={async () => {
            await deleteSocial(record.type);
            actionRef.current?.reload();
            message.success('删除成功');
          }}
        >
          <a style={{ color: 'red' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      {/* 图标管理区域 */}
      <IconManagement onIconsChange={handleIconsChange} />

      {/* 联系方式管理区域 */}
      <Card 
        title="联系方式管理"
        extra={
          <div style={{ fontSize: '12px', color: '#666' }}>
            每页显示10条数据，点击下方按钮添加新联系方式
          </div>
        }
      >

        
        <Spin spinning={loading}>
          <EditableProTable
            rowKey="key"
            actionRef={actionRef}
            headerTitle=""
            maxLength={20}

            recordCreatorProps={false}
            loading={false}
            columns={columns}
            request={fetchData}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total, range) => `共 ${total} 个联系方式`,
            }}
            search={false}
            dateFormatter="string"
            toolBarRender={false}
            editable={{
              type: 'multiple',
              editableKeys,
              onSave: async (key, row) => {
                try {
                  console.log('保存数据:', row);
                  
                  // 执行验证
                  if (!row.displayName || row.displayName.trim() === '') {
                    message.error('显示名称不能为空');
                    throw new Error('显示名称不能为空');
                  }
                  
                  if (!row.iconName) {
                    message.error('请选择图标');
                    throw new Error('请选择图标');
                  }
                  
                  if (!row.linkType) {
                    message.error('请选择链接类型');
                    throw new Error('请选择链接类型');
                  }
                  
                  if (!row.value || row.value.trim() === '') {
                    message.error('链接地址不能为空');
                    throw new Error('链接地址不能为空');
                  }
                  
                  // 根据链接类型进行特定验证
                  if (row.linkType === 'email' && !validateEmail(row.value.trim())) {
                    message.error('请输入有效的邮箱地址');
                    throw new Error('请输入有效的邮箱地址');
                  }
                  
                  if (row.linkType === 'link' && !validateURL(row.value.trim())) {
                    message.error('请输入有效的URL地址');
                    throw new Error('请输入有效的URL地址');
                  }
                  
                  // 获取当前数据用于生成唯一标识符
                  const currentData = await fetchData();
                  
                  // 自动生成类型标识符（如果为空）
                  let typeIdentifier = row.type;
                  if (!typeIdentifier && row.iconName) {
                    typeIdentifier = generateUniqueTypeIdentifier(row.iconName, currentData.data, key);
                    console.log('自动生成类型标识符:', typeIdentifier);
                  }
                  
                  // 构建保存数据
                  const saveData = {
                    displayName: row.displayName.trim(),
                    type: typeIdentifier,
                    iconType: row.iconName || row.iconType || row.type,
                    iconName: row.iconName, // 确保iconName字段被正确保存
                    linkType: row.linkType || 'link',
                    value: row.value.trim(),
                    darkValue: row.darkValue ? row.darkValue.trim() : '',
                    customIconUrl: row.customIconUrl ? row.customIconUrl.trim() : '',
                  };

                  console.log('发送保存请求:', saveData);
                  const response = await updateSocial(saveData);
                  console.log('保存响应:', response);
                  
                  message.success('联系方式保存成功！');
                  
                  // 强制刷新数据
                  setTimeout(() => {
                    actionRef.current?.reload();
                  }, 100);
                  
                } catch (error) {
                  console.error('保存失败:', error);
                  if (!error.message.includes('请输入') && !error.message.includes('不能为空') && !error.message.includes('请选择')) {
                  message.error('保存失败：' + (error.message || '未知错误'));
                  }
                  throw error; // 抛出错误以阻止编辑状态结束
                }
              },
              onChange: setEditableKeys,
            }}
          />
        </Spin>
        
        {/* 添加联系方式按钮 */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            size="large"
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) {
                // 初始化表单数据
                const defaultIconType = socialTypes.length > 0 ? socialTypes[0].iconType : 'github';
                setAddFormData({
                  displayName: '',
                  iconName: defaultIconType,
                  linkType: 'link',
                  value: '',
                  darkValue: '',
                  customIconUrl: ''
                });
              }
            }}
          >
            {showAddForm ? '取消添加' : '添加联系方式'}
          </Button>
        </div>

        {/* 添加表单区域 */}
        {showAddForm && (
          <Card 
            style={{ marginTop: 16 }}
            title="添加新联系方式"
            size="small"
            extra={
              <Button size="small" type="text" onClick={() => setShowAddForm(false)}>
                收起
              </Button>
            }
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 'bold' }}>显示名称 <span style={{ color: 'red' }}>*</span></label>
                </div>
                <Input
                  placeholder="请输入显示名称，如：GitHub、微信群1"
                  value={addFormData.displayName || ''}
                  onChange={(e) => setAddFormData({...addFormData, displayName: e.target.value})}
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 'bold' }}>图标选择 <span style={{ color: 'red' }}>*</span></label>
                </div>
                <Select
                  placeholder="选择图标"
                  value={addFormData.iconName}
                  onChange={(value) => setAddFormData({...addFormData, iconName: value})}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                >
                  <Select.OptGroup label="预设图标">
                    {socialTypes.map(type => (
                      <Select.Option key={`preset-${type.iconType}`} value={type.iconType} label={type.label}>
                        {type.label}
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                  <Select.OptGroup label="自定义图标">
                    {availableIcons.map(icon => (
                      <Select.Option key={`custom-${icon.name}`} value={icon.name} label={`${icon.name} (自定义)`}>
                        {icon.name} (自定义)
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                </Select>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 'bold' }}>链接类型 <span style={{ color: 'red' }}>*</span></label>
                </div>
                <Select
                  value={addFormData.linkType}
                  onChange={(value) => setAddFormData({...addFormData, linkType: value})}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="link">普通链接</Select.Option>
                  <Select.Option value="email">邮箱</Select.Option>
                  <Select.Option value="qrcode">二维码</Select.Option>
                </Select>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontWeight: 'bold' }}>链接地址 <span style={{ color: 'red' }}>*</span></label>
                </div>
                <Input
                  placeholder={
                    addFormData.linkType === 'email' ? '请输入邮箱地址' : 
                    addFormData.linkType === 'qrcode' ? '请输入二维码图片URL' : 
                    '请输入链接地址'
                  }
                  value={addFormData.value || ''}
                  onChange={(e) => setAddFormData({...addFormData, value: e.target.value})}
                />
              </Col>
              {addFormData.linkType === 'qrcode' && (
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontWeight: 'bold' }}>暗色二维码（可选）</label>
                  </div>
                  <Input
                    placeholder="暗色主题下的二维码（可选）"
                    value={addFormData.darkValue || ''}
                    onChange={(e) => setAddFormData({...addFormData, darkValue: e.target.value})}
                  />
                </Col>
              )}
              {/* 自定义图标URL字段 */}
              {addFormData.iconName && 
               !socialTypes.some(type => type.iconType === addFormData.iconName) &&
               !availableIcons.some(icon => icon.name === addFormData.iconName) && (
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontWeight: 'bold' }}>自定义图标URL</label>
                  </div>
                  <Input
                    placeholder="自定义图标URL（浅色）"
                    value={addFormData.customIconUrl || ''}
                    onChange={(e) => setAddFormData({...addFormData, customIconUrl: e.target.value})}
                  />
                </Col>
              )}
            </Row>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setShowAddForm(false)}>
                  取消
                </Button>
                <Button 
                  type="primary" 
                  onClick={async () => {
                    try {
                      // 验证必填字段
                      if (!addFormData.displayName || addFormData.displayName.trim() === '') {
                        message.error('请输入显示名称');
                        return;
                      }
                      if (!addFormData.iconName) {
                        message.error('请选择图标');
                        return;
                      }
                      if (!addFormData.linkType) {
                        message.error('请选择链接类型');
                        return;
                      }
                      if (!addFormData.value || addFormData.value.trim() === '') {
                        message.error('请输入链接地址');
                        return;
                      }

                      // 根据链接类型进行特定验证
                      if (addFormData.linkType === 'email' && !validateEmail(addFormData.value.trim())) {
                        message.error('请输入有效的邮箱地址');
                        return;
                      }
                      if (addFormData.linkType === 'link' && !validateURL(addFormData.value.trim())) {
                        message.error('请输入有效的URL地址');
                        return;
                      }

                      // 获取当前数据用于生成唯一标识符
                      const currentData = await fetchData();
                      const typeIdentifier = generateUniqueTypeIdentifier(addFormData.iconName, currentData.data);

                      // 构建保存数据
                      const saveData = {
                        displayName: addFormData.displayName.trim(),
                        type: typeIdentifier,
                        iconType: addFormData.iconName,
                        iconName: addFormData.iconName, // 确保iconName字段被正确保存
                        linkType: addFormData.linkType,
                        value: addFormData.value.trim(),
                        darkValue: addFormData.darkValue ? addFormData.darkValue.trim() : '',
                        customIconUrl: addFormData.customIconUrl ? addFormData.customIconUrl.trim() : '',
                      };

                      console.log('保存新联系方式:', saveData);
                      await updateSocial(saveData);
                      
                      message.success('联系方式添加成功！');
                      
                      // 重置表单并隐藏
                      setAddFormData({});
                      setShowAddForm(false);
                      
                      // 刷新表格数据
                      setTimeout(() => {
                        actionRef.current?.reload();
                      }, 100);
                      
                    } catch (error) {
                      console.error('添加失败:', error);
                      message.error('添加失败：' + (error.message || '未知错误'));
                    }
                  }}
                >
                  保存
                </Button>
              </Space>
        </div>
          </Card>
        )}

        {/* 图标资源说明 */}
        <Card style={{ marginTop: 16 }} size="small">
          <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
            <span>💡 提示：可以去 </span>
            <a 
              href="https://www.iconfont.cn/collections/index?spm=a313x.collections_index.i1.da2e3581b.48613a8157EhHm&type=1" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#1890ff' }}
            >
              iconfont.cn
            </a>
            <span> 下载SVG图标，支持上传PNG、JPEG、JPG、SVG格式的图标文件</span>
          </div>
        </Card>

      </Card>
    </>
  );
}
