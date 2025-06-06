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
import ImgCrop from 'antd-img-crop';

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
    console.log('开始获取图标列表...', { page, pageSize });
    try {
      const response = await getAllIcons(page, pageSize);
      console.log('图标列表API响应:', response);
      const data = response.data;
      
      if (data && data.icons) {
        // 分页数据
        console.log('处理分页图标数据:', data.icons);
        setIcons(data.icons || []);
        setPagination({
          current: page,
          pageSize,
          total: data.total || 0
        });
        onIconsChange && onIconsChange(data.icons || []);
      } else if (Array.isArray(data)) {
        // 全部数据
        console.log('处理数组图标数据:', data);
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
      const res = await fetch('/api/admin/img/upload', {
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
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      throw error;
    }
  };

  // 处理图标上传
  const handleIconUpload = async (file) => {
    setUploading(true);
    try {
      const iconUrl = await uploadIcon(file);
      const iconName = file.name.split('.')[0]; // 使用文件名作为图标名称
      
      await createIcon({
        name: iconName,
        type: 'custom',
        iconUrl: iconUrl,
        description: `上传的图标: ${file.name}`
      });
      
      message.success('图标上传成功');
      fetchIcons(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('图标上传失败:', error);
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
        <Col>
          <ImgCrop 
            quality={1} 
            aspect={1} 
            fillColor="rgba(255,255,255,0)"
            modalProps={{
              title: '裁剪图标',
              width: 520,
              destroyOnClose: true,
            }}
            cropperProps={{
              background: false,
              guides: true,
              center: true,
              autoCropArea: 0.8,
              dragMode: 'move',
            }}
          >
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => {
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
          </ImgCrop>
        </Col>
        <Col>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            支持PNG、JPG、SVG格式，建议尺寸64x64像素，上传时会自动裁剪为正方形
          </Text>
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

  // 生成建议的类型标识符
  const generateTypeIdentifier = (iconType, existingData) => {
    if (!iconType) return '';
    
    // 获取现有的相同类型的数量
    const existingTypes = existingData.filter(item => 
      item.type && item.type.startsWith(iconType)
    );
    
    if (existingTypes.length === 0) {
      return iconType; // 第一个直接用类型名
    } else {
      return `${iconType}-${existingTypes.length + 1}`; // 后续加数字
    }
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

  // 初始化获取数据
  useEffect(() => {
    fetchSocialTypes();
  }, []);

  const columns = [
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
        rules: [{ required: true, message: '请输入链接地址' }],
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
      <Card title="联系方式管理">

        
        <Spin spinning={loading}>
          <EditableProTable
            rowKey="key"
            actionRef={actionRef}
            headerTitle=""
            maxLength={10}
            recordCreatorProps={{
              record: () => {
                const timestamp = Date.now();
                const defaultIconType = socialTypes.length > 0 ? socialTypes[0].iconType : 'github';
                return {
                  key: `new-${timestamp}`,
                  displayName: '',
                  type: '', // 将在保存时自动生成
                  iconName: defaultIconType,
                  iconType: defaultIconType,
                  linkType: 'link',
                  value: '',
                  darkValue: '',
                  customIconUrl: '',
                };
              },
            }}
            loading={false}
            columns={columns}
            request={fetchData}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
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
                    displayName: row.displayName,
                    type: typeIdentifier,
                    iconType: row.iconName || row.iconType || row.type,
                    linkType: row.linkType || 'link',
                    value: row.value,
                    darkValue: row.darkValue || '',
                    customIconUrl: row.customIconUrl || '',
                  };

                  console.log('发送保存请求:', saveData);
                  const response = await updateSocial(saveData);
                  console.log('保存响应:', response);
                  
                  message.success('保存成功');
                  
                  // 强制刷新数据
                  setTimeout(() => {
                    actionRef.current?.reload();
                  }, 100);
                  
                } catch (error) {
                  console.error('保存失败:', error);
                  message.error('保存失败：' + (error.message || '未知错误'));
                  throw error; // 抛出错误以阻止编辑状态结束
                }
              },
              onChange: setEditableKeys,
            }}
          />
        </Spin>
        
        <Divider />
        
        <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
          <Title level={5}>使用说明：</Title>
          <ul style={{ marginBottom: 0, fontSize: '14px' }}>
            <li><strong>图标管理</strong>：可上传自定义图标到图床，支持PNG、JPG、SVG格式</li>
            <li><strong>显示名称</strong>：在前台显示的文字，如"GitHub"、"微信群1"等</li>
            <li><strong>图标选择</strong>：从预设图标或已上传的自定义图标中选择</li>
            <li><strong>链接类型</strong>：普通链接（跳转）、邮箱（弹窗提示）、二维码（弹窗显示）</li>
            <li><strong>自定义图标URL</strong>：当选择的图标不在列表中时，可直接输入图标URL</li>
            <li><strong>链接地址</strong>：根据链接类型输入相应的地址</li>
            <li><strong>暗色二维码</strong>：仅在链接类型为"二维码"时显示，用于暗色主题</li>
            <li><strong>重复类型支持</strong>：可以添加多个相同类型的联系方式，如多个QQ号、微信群等</li>
          </ul>
        </div>
      </Card>
    </>
  );
}
