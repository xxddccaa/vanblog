import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Switch, 
  TimePicker, 
  InputNumber, 
  Button, 
  message, 
  Spin, 
  List, 
  Typography, 
  Space, 
  Divider,
  Alert,
  Tooltip,
  Tag,
  Modal
} from 'antd';
import { 
  ClockCircleOutlined, 
  PlayCircleOutlined, 
  FileTextOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { 
  getAutoBackupSetting, 
  updateAutoBackupSetting, 
  triggerAutoBackup, 
  getAutoBackupFiles 
} from '@/services/van-blog/api';

const { Text, Title } = Typography;

export default function AutoBackup() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [backupFiles, setBackupFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // 加载设置数据
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await getAutoBackupSetting();
      form.setFieldsValue({
        enabled: data.enabled,
        backupTime: data.backupTime ? moment(data.backupTime, 'HH:mm') : moment('03:00', 'HH:mm'),
        retentionCount: data.retentionCount,
      });
    } catch (error) {
      message.error('加载设置失败：' + (error?.message || '未知错误'));
    }
    setLoading(false);
  };

  // 加载备份文件列表
  const fetchBackupFiles = async () => {
    setFilesLoading(true);
    try {
      const { data } = await getAutoBackupFiles();
      setBackupFiles(data);
    } catch (error) {
      message.error('加载备份文件列表失败：' + (error?.message || '未知错误'));
    }
    setFilesLoading(false);
  };

  // 保存设置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const settingData = {
        enabled: values.enabled,
        backupTime: values.backupTime.format('HH:mm'),
        retentionCount: values.retentionCount,
      };

      await updateAutoBackupSetting(settingData);
      message.success('设置保存成功！');
      
      if (settingData.enabled) {
        message.info(`自动备份已启用，将在每天 ${settingData.backupTime} 执行`);
      } else {
        message.info('自动备份已停用');
      }
    } catch (error) {
      message.error('保存设置失败：' + (error?.message || '未知错误'));
    }
    setLoading(false);
  };

  // 手动触发备份
  const handleTriggerBackup = async () => {
    Modal.confirm({
      title: '确认手动备份',
      content: '确定要立即执行一次备份吗？这将创建一个新的备份文件。',
      onOk: async () => {
        setTriggering(true);
        try {
          await triggerAutoBackup();
          message.success('备份任务已触发，请稍后查看备份文件列表');
          // 延迟刷新文件列表，等待备份完成
          setTimeout(() => {
            fetchBackupFiles();
          }, 3000);
        } catch (error) {
          message.error('触发备份失败：' + (error?.message || '未知错误'));
        }
        setTriggering(false);
      },
    });
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    fetchSettings();
    fetchBackupFiles();
  }, []);

  return (
    <div>
      <Card title="自动备份设置" style={{ marginBottom: 24 }}>
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="自动备份说明"
          description={
            <div>
              <p><strong>备份内容：</strong>与手动导出功能完全一致，包含所有文章、草稿、设置等数据。</p>
              <p><strong>备份位置：</strong>文件保存在 <code>/static/blog-json/</code> 目录下。</p>
              <p><strong>文件清理：</strong>系统会自动清理旧备份，只保留最新的指定数量文件。</p>
            </div>
          }
          style={{ marginBottom: 20 }}
        />

        <Spin spinning={loading}>
          <Form
            form={form}
            layout="horizontal"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 14 }}
          >
            <Form.Item
              name="enabled"
              label="启用自动备份"
              valuePropName="checked"
            >
              <Switch 
                checkedChildren="启用" 
                unCheckedChildren="停用"
              />
            </Form.Item>

            <Form.Item
              name="backupTime"
              label="备份时间"
              tooltip="每天执行备份的时间"
            >
              <TimePicker
                format="HH:mm"
                placeholder="选择备份时间"
                showNow={false}
              />
            </Form.Item>

            <Form.Item
              name="retentionCount"
              label="保留文件数量"
              tooltip="保留最新的几个备份文件，超过此数量的旧备份会被自动删除（按文件修改时间排序）"
              rules={[
                { required: true, message: '请输入保留文件数量' },
                { type: 'number', min: 1, max: 100, message: '保留文件数量应在1-100之间' }
              ]}
            >
              <InputNumber
                min={1}
                max={100}
                style={{ width: 120 }}
                addonAfter="个"
              />
            </Form.Item>

            <Form.Item wrapperCol={{ offset: 6, span: 14 }}>
              <Space>
                <Button 
                  type="primary" 
                  onClick={handleSave}
                  loading={loading}
                >
                  保存设置
                </Button>
                <Button 
                  icon={<PlayCircleOutlined />}
                  onClick={handleTriggerBackup}
                  loading={triggering}
                >
                  立即备份
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Spin>
      </Card>

      <Card 
        title={
          <Space>
            <FileTextOutlined />
            <span>备份文件列表</span>
            <Button 
              type="link" 
              size="small" 
              onClick={fetchBackupFiles}
              loading={filesLoading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Spin spinning={filesLoading}>
          {backupFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>暂无备份文件</div>
              <div>启用自动备份或手动触发备份后，文件将显示在这里</div>
            </div>
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={backupFiles}
              renderItem={(file) => (
                <List.Item
                  actions={[
                    <Tooltip title="文件大小">
                      <Tag color="blue">{formatFileSize(file.size)}</Tag>
                    </Tooltip>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                    title={
                      <Space>
                        <Text strong>{file.name}</Text>
                      </Space>
                    }
                    description={
                      <Space split={<Divider type="vertical" />}>
                        <span>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          创建时间: {moment(file.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                        </span>
                        <span>
                          修改时间: {moment(file.modifiedAt).format('YYYY-MM-DD HH:mm:ss')}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>

      <div style={{ marginTop: 24, padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
        <Title level={5}>💡 使用提示</Title>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><Text strong>自动执行：</Text>启用后系统会在指定时间自动创建备份文件</li>
          <li><Text strong>文件命名：</Text>备份文件采用 vanblog-backup-YYYY-MM-DD-HHmmss.json 格式命名</li>
          <li><Text strong>存储位置：</Text>备份文件保存在 /static/blog-json/ 目录，可通过文件系统直接访问</li>
          <li><Text strong>自动清理：</Text>系统会自动删除旧备份文件，只保留最新的指定数量（按修改时间排序）</li>
          <li><Text strong>数据恢复：</Text>备份文件可以通过"备份恢复"页面的导入功能进行恢复</li>
          <li><Text strong>立即备份：</Text>点击"立即备份"可以不等待定时任务，马上创建一个备份</li>
          <li><Text strong>多次备份：</Text>一天内可以有多个备份文件，系统按文件时间排序保留最新的</li>
        </ul>
      </div>
    </div>
  );
} 