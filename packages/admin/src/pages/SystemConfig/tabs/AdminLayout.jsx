import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BgColorsOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Button, Card, Form, Input, Modal, Space, Table, Tooltip, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useModel } from '@umijs/max';
import {
  getAdminLayoutConfig,
  getAdminThemeConfig,
  resetAdminLayoutToDefault,
  resetAdminThemeToDefault,
  updateAdminLayoutConfig,
  updateAdminThemeConfig,
} from '@/services/van-blog/api';
import ColorValueInput, { optionalHexRule } from '@/components/ColorValueInput';
import { applyThemeToDocument, getInitTheme } from '@/services/van-blog/theme';
import {
  getAdminPrimaryColor,
  normalizeAdminThemeConfig,
  storeAdminThemeConfig,
} from '@/utils/adminTheme';

const themeFieldRules = [{ required: true, message: '请输入十六进制颜色值' }, optionalHexRule];
const isPersistedThemeConfig = (value) =>
  typeof value?.lightPrimaryColor === 'string' &&
  typeof value?.darkPrimaryColor === 'string' &&
  typeof value?.lightBackgroundColor === 'string' &&
  typeof value?.darkBackgroundColor === 'string';

export default function AdminLayout() {
  const { initialState, setInitialState } = useModel('@@initialState');
  const [loading, setLoading] = useState(false);
  const [themeSubmitting, setThemeSubmitting] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [themeForm] = Form.useForm();

  const fetchLayoutData = useCallback(async () => {
    const { data } = await getAdminLayoutConfig();
    if (data?.menuItems) {
      const sortedItems = [...data.menuItems].sort((a, b) => a.order - b.order);
      setMenuItems(sortedItems);
    }
  }, []);

  const fetchThemeData = useCallback(async () => {
    const { data } = await getAdminThemeConfig();
    const normalizedConfig = normalizeAdminThemeConfig(data);
    themeForm.setFieldsValue(normalizedConfig);
    return normalizedConfig;
  }, [themeForm]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchLayoutData(), fetchThemeData()]);
    } catch (error) {
      message.error('获取后台布局配置失败');
    } finally {
      setLoading(false);
    }
  }, [fetchLayoutData, fetchThemeData]);

  const applyThemeImmediately = useCallback(
    (nextConfig) => {
      const normalizedConfig = storeAdminThemeConfig(nextConfig);
      const currentTheme = initialState?.theme || getInitTheme();
      applyThemeToDocument(currentTheme, normalizedConfig);
      setInitialState((state) => ({
        ...state,
        adminThemeConfig: normalizedConfig,
        settings: {
          ...state?.settings,
          primaryColor: getAdminPrimaryColor(currentTheme, normalizedConfig),
        },
      }));
    },
    [initialState?.theme, setInitialState],
  );

  const handleThemeSave = async () => {
    try {
      const values = await themeForm.validateFields();
      const normalizedConfig = normalizeAdminThemeConfig(values);
      setThemeSubmitting(true);
      const { data } = await updateAdminThemeConfig(normalizedConfig);
      const persistedConfig = isPersistedThemeConfig(data)
        ? normalizeAdminThemeConfig(data)
        : await fetchThemeData();
      applyThemeImmediately(persistedConfig);
      themeForm.setFieldsValue(persistedConfig);
      message.success('后台主题色已保存并即时生效');
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error('保存后台主题色失败，请稍后重试');
    } finally {
      setThemeSubmitting(false);
    }
  };

  const handleResetTheme = () => {
    Modal.confirm({
      title: '恢复默认后台配色',
      content: '确定恢复默认的亮色/暗色主色吗？这不会影响菜单顺序和显隐配置。',
      onOk: async () => {
        try {
          setThemeSubmitting(true);
          const { data } = await resetAdminThemeToDefault();
          const fallbackConfig = isPersistedThemeConfig(data)
            ? normalizeAdminThemeConfig(data)
            : await fetchThemeData();
          applyThemeImmediately(fallbackConfig);
          themeForm.setFieldsValue(fallbackConfig);
          message.success('后台主题色已恢复为默认配色');
        } catch (error) {
          message.error('恢复默认后台配色失败，请重试');
        } finally {
          setThemeSubmitting(false);
        }
      },
    });
  };

  const handleResetToDefault = () => {
    Modal.confirm({
      title: '恢复系统默认设置',
      content: (
        <div>
          <p>确定要恢复到系统默认的后台布局设置吗？</p>
          <p style={{ color: '#ff4d4f' }}>
            此操作将清除所有自定义菜单布局设置，恢复为系统默认菜单顺序与显示状态。
          </p>
        </div>
      ),
      onOk: async () => {
        try {
          setLoading(true);
          await resetAdminLayoutToDefault();
          await fetchLayoutData();
          message.success('后台菜单布局已恢复默认');
        } catch (error) {
          message.error('恢复默认菜单布局失败，请重试');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateAdminLayoutConfig({ menuItems });
      message.success('后台布局已保存，刷新页面后可看到菜单结构变化');
    } catch (error) {
      message.error('保存后台布局失败');
    } finally {
      setLoading(false);
    }
  };

  const moveUp = (index) => {
    if (index <= 0) {
      return;
    }
    const newItems = [...menuItems];
    [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
    setMenuItems(newItems.map((item, idx) => ({ ...item, order: idx })));
  };

  const moveDown = (index) => {
    if (index >= menuItems.length - 1) {
      return;
    }
    const newItems = [...menuItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setMenuItems(newItems.map((item, idx) => ({ ...item, order: idx })));
  };

  const toggleVisible = (key) => {
    setMenuItems((items) =>
      items.map((item) => (item.key === key ? { ...item, visible: !item.visible } : item)),
    );
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    form.setFieldsValue({ name: item.name });
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        setMenuItems((items) =>
          items.map((item) =>
            item.key === editingItem.key ? { ...item, name: values.name } : item,
          ),
        );
      }
      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
    } catch (error) {}
  };

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
        <span style={{ textDecoration: !record.visible ? 'line-through' : 'none' }}>{text}</span>
      ),
    },
    {
      title: '原始名称',
      dataIndex: 'originalName',
      render: (text) => <span style={{ color: 'var(--admin-auth-text-secondary)' }}>{text}</span>,
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
        title="后台主题色"
        extra={
          <Space>
            <Button onClick={fetchThemeData} loading={loading || themeSubmitting}>
              刷新颜色
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleResetTheme} loading={themeSubmitting}>
              恢复默认配色
            </Button>
            <Button
              type="primary"
              icon={<BgColorsOutlined />}
              onClick={handleThemeSave}
              loading={themeSubmitting}
            >
              保存配色
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          配置后台亮色/暗色的整体背景色，以及按钮、链接、选中态等强调色。保存后后台壳层、登录页、初始化页和浏览器主题色会立即同步更新。
        </Typography.Paragraph>
        <Form form={themeForm} layout="vertical" initialValues={initialState?.adminThemeConfig}>
          <Space size={16} wrap style={{ width: '100%' }}>
            <Form.Item
              label="亮色背景色"
              name="lightBackgroundColor"
              rules={themeFieldRules}
              style={{ minWidth: 240, marginBottom: 0 }}
            >
              <ColorValueInput placeholder="#f4f8fb" defaultValue="#f4f8fb" />
            </Form.Item>
            <Form.Item
              label="暗色背景色"
              name="darkBackgroundColor"
              rules={themeFieldRules}
              style={{ minWidth: 240, marginBottom: 0 }}
            >
              <ColorValueInput placeholder="#111827" defaultValue="#111827" />
            </Form.Item>
            <Form.Item
              label="亮色按钮/强调色"
              name="lightPrimaryColor"
              rules={themeFieldRules}
              style={{ minWidth: 240, marginBottom: 0 }}
            >
              <ColorValueInput placeholder="#1772b4" defaultValue="#1772b4" />
            </Form.Item>
            <Form.Item
              label="暗色按钮/强调色"
              name="darkPrimaryColor"
              rules={themeFieldRules}
              style={{ minWidth: 240, marginBottom: 0 }}
            >
              <ColorValueInput placeholder="#60a5fa" defaultValue="#60a5fa" />
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card
        title="后台布局管理"
        extra={
          <Space>
            <Button onClick={fetchLayoutData} loading={loading}>
              刷新
            </Button>
            <Button type="primary" onClick={handleSave} loading={loading}>
              保存配置
            </Button>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={handleResetToDefault}
              loading={loading}
            >
              恢复系统默认设置
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16, color: 'var(--admin-auth-text-secondary)', fontSize: 14 }}>
          • 点击上移/下移按钮可以调整菜单顺序
          <br />
          • 点击眼睛图标可以切换菜单显示/隐藏
          <br />
          • 点击“编辑名称”可以修改菜单显示名称
          <br />
          • 点击“恢复系统默认设置”只恢复菜单布局，不影响后台主题色
          <br />• 修改菜单布局后需要刷新页面才能看到完整菜单变化
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
            label="菜单名称"
            rules={[
              { required: true, message: '请输入菜单名称' },
              { max: 10, message: '菜单名称不能超过10个字符' },
            ]}
          >
            <Input placeholder="请输入菜单名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
