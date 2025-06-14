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
  Modal,
  Row,
  Col,
  Input
} from 'antd';
import { 
  ClockCircleOutlined, 
  PlayCircleOutlined, 
  FileTextOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  CloudOutlined,
  LoginOutlined,
  LogoutOutlined,
  SyncOutlined,
  CloudUploadOutlined,
  LinkOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import moment from 'moment';
import { 
  getAutoBackupSetting, 
  updateAutoBackupSetting, 
  triggerAutoBackup, 
  getAutoBackupFiles,
  getAliyunpanStatus,
  startAliyunpanLogin,
  completeAliyunpanLogin,
  checkAliyunpanLogin,
  logoutAliyunpan,
  testAliyunpanConnection,
  triggerAliyunpanSync
} from '@/services/van-blog/api';

const { Text, Title } = Typography;

export default function AutoBackup() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [backupFiles, setBackupFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [aliyunpanStatus, setAliyunpanStatus] = useState(null);
  const [aliyunpanLoading, setAliyunpanLoading] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [checkingLogin, setCheckingLogin] = useState(false);

  // 加载设置数据
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await getAutoBackupSetting();
      form.setFieldsValue({
        enabled: data.enabled,
        backupTime: data.backupTime ? moment(data.backupTime, 'HH:mm') : moment('03:00', 'HH:mm'),
        retentionCount: data.retentionCount,
        aliyunpanEnabled: data.aliyunpan?.enabled || false,
        syncTime: data.aliyunpan?.syncTime ? moment(data.aliyunpan.syncTime, 'HH:mm') : moment('03:30', 'HH:mm'),
        localPath: data.aliyunpan?.localPath || '/app/static',
        panPath: data.aliyunpan?.panPath || '/backup/vanblog-static',
      });
    } catch (error) {
      message.error('加载设置失败：' + (error?.message || '未知错误'));
    }
    setLoading(false);
  };

  // 获取阿里云盘状态
  const fetchAliyunpanStatus = async () => {
    setAliyunpanLoading(true);
    try {
      const res = await getAliyunpanStatus();
      if (res.statusCode === 200) {
        setAliyunpanStatus(res.data);
      }
    } catch (error) {
      console.error('获取阿里云盘状态失败', error);
    }
    setAliyunpanLoading(false);
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
        aliyunpan: {
          enabled: values.aliyunpanEnabled,
          syncTime: values.syncTime.format('HH:mm'),
          localPath: values.localPath,
          panPath: values.panPath,
        },
      };

      await updateAutoBackupSetting(settingData);
      message.success('设置保存成功！');
      
      if (settingData.enabled) {
        message.info(`自动备份已启用，将在每天 ${settingData.backupTime} 执行`);
      } else {
        message.info('自动备份已停用');
      }

      if (settingData.aliyunpan.enabled) {
        message.info(`阿里云盘备份已启用，将在每天 ${settingData.aliyunpan.syncTime} 执行`);
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

  // 阿里云盘登录
  const handleAliyunpanLogin = async () => {
    setAliyunpanLoading(true);
    try {
      const res = await startAliyunpanLogin();
      if (res.statusCode === 200) {
        setLoginUrl(res.data.loginUrl);
        setLoginModalVisible(true);
        message.info('请在浏览器中完成扫码登录');
      } else {
        message.error(res.message || '获取登录链接失败');
      }
    } catch (error) {
      message.error('登录失败');
    }
    setAliyunpanLoading(false);
  };

  // 完成登录（发送回车确认）
  const completeLogin = async () => {
    setCheckingLogin(true);
    try {
      const res = await completeAliyunpanLogin();
      if (res.statusCode === 200) {
        message.success('登录成功');
        setLoginModalVisible(false);
        fetchAliyunpanStatus();
      } else {
        message.error(res.message || '登录失败，请确保已在浏览器中完成扫码');
      }
    } catch (error) {
      message.error('完成登录失败');
    }
    setCheckingLogin(false);
  };

  // 检查登录状态
  const checkLoginStatus = async () => {
    setCheckingLogin(true);
    try {
      const res = await checkAliyunpanLogin();
      if (res.statusCode === 200 && res.data.isCompleted) {
        message.success('登录成功');
        setLoginModalVisible(false);
        fetchAliyunpanStatus();
      } else {
        message.info('请继续在浏览器中完成登录');
      }
    } catch (error) {
      message.error('检查登录状态失败');
    }
    setCheckingLogin(false);
  };

  // 阿里云盘退出登录
  const handleAliyunpanLogout = async () => {
    setAliyunpanLoading(true);
    try {
      const res = await logoutAliyunpan();
      if (res.statusCode === 200) {
        message.success('退出登录成功');
        fetchAliyunpanStatus();
      } else {
        message.error(res.message || '退出登录失败');
      }
    } catch (error) {
      message.error('退出登录失败');
    }
    setAliyunpanLoading(false);
  };

  // 测试阿里云盘连接
  const handleTestConnection = async () => {
    setAliyunpanLoading(true);
    try {
      const res = await testAliyunpanConnection();
      if (res.statusCode === 200) {
        message.success('连接测试成功');
      } else {
        message.error(res.message || '连接测试失败');
      }
    } catch (error) {
      message.error('连接测试失败');
    }
    setAliyunpanLoading(false);
  };

  // 手动同步到阿里云盘
  const handleAliyunpanSync = async () => {
    setAliyunpanLoading(true);
    try {
      const res = await triggerAliyunpanSync();
      if (res.statusCode === 200) {
        message.success('阿里云盘同步完成');
      } else {
        message.error(res.message || '同步失败');
      }
    } catch (error) {
      message.error('同步失败');
    }
    setAliyunpanLoading(false);
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
    fetchAliyunpanStatus();
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

            {/* 阿里云盘设置分隔符 */}
            <Divider orientation="left">
              <Space>
                <CloudOutlined />
                <span>阿里云盘备份</span>
              </Space>
            </Divider>

            {/* 阿里云盘状态显示 */}
            <Form.Item label="阿里云盘状态">
              <Card size="small" style={{ width: '100%' }}>
                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <Space>
                      <CloudOutlined />
                      <Text strong>状态：</Text>
                      {aliyunpanLoading ? (
                        <Spin size="small" />
                      ) : aliyunpanStatus?.isLoggedIn ? (
                        <Tag color="green">已登录</Tag>
                      ) : (
                        <Tag color="red">未登录</Tag>
                      )}
                    </Space>
                    {aliyunpanStatus?.userInfo && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">
                          用户：{aliyunpanStatus.userInfo.nickName || aliyunpanStatus.userInfo.userName}
                        </Text>
                      </div>
                    )}
                    {aliyunpanStatus?.quota && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">
                          空间：{aliyunpanStatus.quota.usedSpace} / {aliyunpanStatus.quota.totalSpace}
                        </Text>
                      </div>
                    )}
                  </Col>
                  <Col span={12}>
                    <Space>
                      {aliyunpanStatus?.isLoggedIn ? (
                        <>
                          <Button
                            icon={<SyncOutlined />}
                            onClick={handleTestConnection}
                            loading={aliyunpanLoading}
                            size="small"
                          >
                            测试连接
                          </Button>
                          <Button
                            icon={<LogoutOutlined />}
                            onClick={handleAliyunpanLogout}
                            loading={aliyunpanLoading}
                            size="small"
                          >
                            退出登录
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="primary"
                          icon={<LoginOutlined />}
                          onClick={handleAliyunpanLogin}
                          loading={aliyunpanLoading}
                          size="small"
                        >
                          登录阿里云盘
                        </Button>
                      )}
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchAliyunpanStatus}
                        loading={aliyunpanLoading}
                        size="small"
                      >
                        刷新状态
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Form.Item>

            <Form.Item
              name="aliyunpanEnabled"
              label="启用阿里云盘备份"
              valuePropName="checked"
              tooltip="需要先登录阿里云盘才能启用"
            >
              <Switch 
                checkedChildren="启用" 
                unCheckedChildren="停用"
                disabled={!aliyunpanStatus?.isLoggedIn}
              />
            </Form.Item>

            <Form.Item
              name="syncTime"
              label="阿里云盘同步时间"
              tooltip="每天同步本地文件到阿里云盘的时间"
            >
              <TimePicker
                format="HH:mm"
                placeholder="选择同步时间"
                showNow={false}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="localPath"
                  label="本地路径"
                  tooltip="要同步到阿里云盘的本地目录"
                  labelCol={{ span: 12 }}
                  wrapperCol={{ span: 12 }}
                >
                  <Input placeholder="/app/static" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="panPath"
                  label="云盘路径"
                  tooltip="在阿里云盘中存储文件的目录"
                  labelCol={{ span: 12 }}
                  wrapperCol={{ span: 12 }}
                >
                  <Input placeholder="/backup/vanblog-static" />
                </Form.Item>
              </Col>
            </Row>

            <Alert
              message="阿里云盘备份说明"
              description={
                <div>
                  <p><strong>功能说明：</strong>将本地static目录增量同步到阿里云盘的备份盘中。</p>
                  <p><strong>首次使用：</strong>需要先点击"登录阿里云盘"按钮，在浏览器中完成扫码登录。</p>
                  <p><strong>同步策略：</strong>采用增量同步，只上传新增或修改的文件，不会删除云盘中的现有文件。</p>
                  <p><strong>存储位置：</strong>文件会保存到阿里云盘的"备份盘"中，而不是"资源盘"。</p>
                </div>
              }
              type="info"
              icon={<InfoCircleOutlined />}
              style={{ marginBottom: 16 }}
            />

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
                {aliyunpanStatus?.isLoggedIn && (
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={handleAliyunpanSync}
                    loading={aliyunpanLoading}
                  >
                    立即同步到阿里云盘
                  </Button>
                )}
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

      {/* 阿里云盘登录弹窗 */}
      <Modal
        title="阿里云盘登录"
        open={loginModalVisible}
        onCancel={() => setLoginModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setLoginModalVisible(false)}>
            取消
          </Button>,
          <Button key="complete" type="primary" loading={checkingLogin} onClick={completeLogin}>
            完成登录
          </Button>,
          <Button key="check" loading={checkingLogin} onClick={checkLoginStatus}>
            检查状态
          </Button>,
        ]}
      >
        <div>
          <Alert
            message="登录说明"
            description="请按照以下步骤完成阿里云盘登录："
            type="info"
            style={{ marginBottom: 16 }}
          />
          <div style={{ marginBottom: 16 }}>
            <Text strong>登录链接：</Text>
            <div style={{ marginTop: 8 }}>
              <Input.Group compact>
                <Input
                  style={{ width: 'calc(100% - 80px)' }}
                  value={loginUrl}
                  readOnly
                />
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={() => window.open(loginUrl, '_blank')}
                >
                  打开
                </Button>
              </Input.Group>
            </div>
          </div>
          <Alert
            message="操作步骤"
            description={
              <ol style={{ marginBottom: 0 }}>
                <li>点击"打开"按钮在新标签页中打开登录链接</li>
                <li>在阿里云盘页面完成授权操作</li>
                <li>使用阿里云盘App扫码登录</li>
                <li>完成扫码后，点击"完成登录"按钮确认登录</li>
                <li>如果登录失败，可以点击"检查状态"按钮重新检查</li>
              </ol>
            }
            type="warning"
            style={{ marginBottom: 16 }}
          />
          <Text type="secondary">
            注意：登录链接有效期为5分钟，如果超时请重新获取。
          </Text>
        </div>
      </Modal>
    </div>
  );
} 