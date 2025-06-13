import { exportAll, clearAllData } from '@/services/van-blog/api';
import { Alert, Button, Card, message, Modal, Space, Spin, Upload, Typography, Divider, List, Popconfirm } from 'antd';
import moment from 'moment';
import { useState } from 'react';
import { DownloadOutlined, UploadOutlined, InfoCircleOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export default function (props) {
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  
  const handleOutPut = async () => {
    setLoading(true);
    try {
      const data = await exportAll();
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vanblog-backup-${moment().format('YYYY-MM-DD-HHmmss')}.json`;
      link.click();
      message.success('备份文件导出成功！');
    } catch (error) {
      message.error('导出失败：' + (error?.message || '未知错误'));
    }
    setLoading(false);
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '⚠️ 危险操作确认',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="此操作将不可逆转！"
            description="这将清空所有博客数据，包括文章、草稿、动态、分类、导航、自定义页面等所有内容，且无法恢复！"
            style={{ margin: '16px 0' }}
          />
          <p><Text strong>请确认您要执行以下操作：</Text></p>
          <ul>
            <li>删除所有文章和草稿</li>
            <li>删除所有动态/时刻</li>
            <li>删除所有分类和标签</li>
            <li>删除所有自定义页面</li>
            <li>删除所有导航工具和分类</li>
            <li>删除所有流水线配置</li>
            <li>清空访问统计数据</li>
            <li>重置网站为初始状态</li>
          </ul>
          <Alert
            type="warning"
            message="建议在执行此操作前先导出备份！"
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      width: 520,
      okText: '我确认要清空所有数据',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        // 二次确认
        Modal.confirm({
          title: '最后确认',
          icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
          content: (
            <div>
              <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                请再次确认：您真的要清空所有博客数据吗？
              </Text>
              <p style={{ marginTop: 16 }}>
                此操作执行后，您的博客将回到初始安装状态，所有内容都将丢失！
              </p>
            </div>
          ),
          okText: '是的，我要清空所有数据',
          okType: 'danger',
          cancelText: '我再想想',
          onOk: async () => {
            setClearLoading(true);
            try {
              const result = await clearAllData();
              if (result.statusCode === 200) {
                Modal.success({
                  title: '清空成功！',
                  content: (
                    <div>
                      <p>所有数据已清空，博客已重置为初始状态。</p>
                      {result.clearResults && (
                        <div style={{ marginTop: 16 }}>
                          <Text strong>清空统计：</Text>
                          <ul style={{ marginTop: 8 }}>
                            {Object.entries(result.clearResults).map(([key, value]) => 
                              value > 0 ? (
                                <li key={key}>
                                  {key}: {value} 条
                                </li>
                              ) : null
                            )}
                          </ul>
                        </div>
                      )}
                      <p style={{ marginTop: 16, color: '#1890ff' }}>
                        页面将在3秒后自动刷新...
                      </p>
                    </div>
                  ),
                  onOk: () => {
                    setTimeout(() => window.location.reload(), 1000);
                  }
                });
              } else {
                message.error(`清空失败: ${result?.message || '未知错误'}`);
              }
            } catch (error) {
              message.error('清空失败：' + (error?.message || '网络错误'));
            }
            setClearLoading(false);
          }
        });
      }
    });
  };

  const dataTypes = [
    { name: '文章数据', desc: '包括所有已发布的文章内容、标题、标签、分类等' },
    { name: '草稿数据', desc: '所有草稿的内容和元数据' },
    { name: '动态数据', desc: '所有动态/时刻的内容和时间信息' },
    { name: '分类管理', desc: '文章分类及其属性设置' },
    { name: '标签数据', desc: '所有标签及其关联关系' },
    { name: '自定义页面', desc: '自定义HTML页面的内容和配置' },
    { name: '导航工具', desc: '导航页面的工具和分类设置' },
    { name: '用户设置', desc: '管理员用户的配置信息' },
    { name: '网站配置', desc: '站点信息、主题设置等全局配置' },
    { name: '图片记录', desc: '图床中的图片记录（不包含图片文件本身）' },
    { name: '流水线配置', desc: '自动化流水线的脚本和配置' },
    { name: '访问统计', desc: '访客记录和访问统计数据' },
  ];

  return (
    <Card title="数据备份与恢复">
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="重要说明"
        description={
          <div>
            <p><strong>备份范围：</strong>当前备份功能已升级，现在包含更全面的数据类型。</p>
            <p><strong>图片文件：</strong>备份不包含图床中的实际图片文件，仅包含图片记录。本地图床图片请在图床设置中单独导出。</p>
            <p><strong>导入策略：</strong>导入时相同ID的数据以新导入的为准，自动重建分类关系。</p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>📊 备份数据类型</Title>
        <List
          size="small"
          dataSource={dataTypes}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong>{item.name}</Text>}
                description={item.desc}
              />
            </List.Item>
          )}
          style={{ 
            background: '#fafafa', 
            padding: '16px', 
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        />
      </div>

      <Divider />

      <Spin spinning={loading || uploadLoading || clearLoading}>
        <Space size="large" style={{ width: '100%', justifyContent: 'center' }}>
          <Upload
            showUploadList={false}
            name="file"
            accept=".json"
            action="/api/admin/backup/import"
            headers={{
              token: (() => {
                return window.localStorage.getItem('token') || 'null';
              })(),
            }}
            beforeUpload={(file) => {
              // 验证文件类型
              if (!file.name.endsWith('.json')) {
                message.error('请选择正确的备份文件（.json格式）');
                return false;
              }
              setUploadLoading(true);
              return true;
            }}
            onChange={(info) => {
              if (info.file.status !== 'uploading') {
                setUploadLoading(false);
              }
              if (info.file.status === 'done') {
                if (location.hostname == 'blog-demo.mereith.com') {
                  Modal.info({
                    title: '演示站禁止修改此项！',
                    content: '因为有个人在演示站首页放黄色信息，所以关了这个权限了。',
                  });
                  return;
                }
                
                const response = info.file.response;
                if (response?.statusCode === 200) {
                  Modal.success({
                    title: '导入成功！',
                    content: (
                      <div>
                        <p>数据已成功导入，页面将在3秒后自动刷新。</p>
                        {response.importResults && (
                          <div style={{ marginTop: 16 }}>
                            <Text strong>导入统计：</Text>
                            <ul style={{ marginTop: 8 }}>
                              {Object.entries(response.importResults).map(([key, value]) => 
                                value > 0 ? (
                                  <li key={key}>
                                    {key}: {value} 条
                                  </li>
                                ) : null
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    ),
                    onOk: () => {
                      setTimeout(() => window.location.reload(), 1000);
                    }
                  });
                } else {
                  message.error(`导入失败: ${response?.message || '未知错误'}`);
                }
              } else if (info.file.status === 'error') {
                message.error(`${info.file.name} 上传失败！请检查文件格式和网络连接。`);
                setUploadLoading(false);
              }
            }}
          >
            <Button 
              icon={<UploadOutlined />}
              size="large"
              loading={uploadLoading}
            >
              导入全部数据
            </Button>
          </Upload>
          
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            size="large"
            onClick={handleOutPut}
            loading={loading}
          >
            导出全部数据
          </Button>

          <Button 
            danger
            icon={<DeleteOutlined />}
            size="large"
            onClick={handleClearAll}
            loading={clearLoading}
          >
            清空所有数据
          </Button>
        </Space>
      </Spin>

      <div style={{ marginTop: 24 }}>
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="危险操作警告"
          description={
            <div>
              <p><Text strong>"清空所有数据"</Text> 将永久删除博客中的所有内容，包括文章、草稿、动态、分类、导航等，此操作不可逆转！</p>
              <p>执行前请务必先导出备份数据。此功能主要用于：</p>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>重置博客到初始状态</li>
                <li>测试环境数据清理</li>
                <li>迁移前的数据清空</li>
              </ul>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      </div>

      <div style={{ marginTop: 24, padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
        <Title level={5}>💡 使用提示</Title>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>建议定期备份数据，特别是在重要更新前</li>
          <li>备份文件包含敏感信息，请妥善保管</li>
          <li>导入数据前建议先备份当前数据</li>
          <li>大量数据的导入可能需要较长时间，请耐心等待</li>
          <li>如遇到导入问题，请检查备份文件的完整性</li>
          <li><Text strong style={{ color: '#ff4d4f' }}>清空操作无法撤销，请谨慎使用！</Text></li>
        </ul>
      </div>
    </Card>
  );
}
