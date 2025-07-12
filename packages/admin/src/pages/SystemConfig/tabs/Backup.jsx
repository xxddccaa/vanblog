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
            <li>删除所有私密文档库和文档</li>
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

  const exportDataTypes = [
    { name: '✅ 文章数据 (articles)', desc: '所有已发布的文章：标题、内容、标签、分类、置顶、隐私设置、浏览量等完整信息' },
    { name: '✅ 草稿数据 (drafts)', desc: '所有草稿：标题、内容、标签、分类等，用于恢复未发布的文章' },
    { name: '✅ 动态数据 (moments)', desc: '所有动态/时刻：内容、发布时间、删除状态等' },
    { name: '✅ 分类管理 (categories)', desc: '文章分类列表：分类名称、隐私设置、密码保护等' },
    { name: '✅ 标签数据 (tags)', desc: '所有文章标签：自动从文章中提取和同步' },
    { name: '✅ 自定义页面 (customPages)', desc: '自定义HTML页面：路径、内容、模板等' },
    { name: '✅ 导航管理 (navTools/navCategories)', desc: '导航页面的工具链接、分类、图标等配置' },
    { name: '✅ 图标数据 (icons)', desc: '自定义上传的图标文件记录和使用信息' },
    { name: '✅ 静态文件记录 (static)', desc: '图床文件索引：文件路径、元数据、签名等（不含实际文件）' },
    { name: '✅ 流水线配置 (pipelines)', desc: '自动化脚本：触发条件、执行代码、配置参数' },
    { name: '✅ 访问统计 (viewer/visit)', desc: '网站访问记录：每日访客数、页面浏览量统计' },
    { name: '✅ 网站元数据 (meta)', desc: '关于页面、菜单、链接、社交账号、打赏等（不含用户和站点信息）' },
    { name: '✅ 系统设置 (setting)', desc: '图床配置、静态文件设置等' },
    { name: '✅ 定制化设置 (layoutSetting)', desc: '自定义CSS、JavaScript、HTML代码' },
    { name: '✅ AI标签配置 (aiTaggingConfig)', desc: 'AI自动打标：API密钥、模型参数、对话模板等' },
    { name: '✅ 私密文档库 (documents)', desc: '所有私密文档库和文档：文档库、文档、内容、层级关系等' },
  ];

  const importDataTypes = [
    { name: '✅ 内容数据', desc: '文章、草稿、动态：增量导入，ID冲突时自动重新分配，相同标题则更新' },
    { name: '✅ 分类和标签', desc: '自动创建缺失的分类，标签从导入文章中自动同步' },
    { name: '✅ 导航配置', desc: '导航工具和分类：存在则更新，不存在则创建' },
    { name: '✅ 自定义页面和流水线', desc: '按路径/名称匹配，存在则更新，不存在则创建' },
    { name: '✅ 静态文件记录', desc: '按文件签名去重，避免重复导入相同文件' },
    { name: '✅ 定制化设置', desc: '增量导入：与现有配置合并，不会清空已有的自定义代码' },
    { name: '✅ AI标签配置', desc: '覆盖导入：完全替换现有的AI配置参数' },
    { name: '✅ 私密文档库', desc: '增量导入：ID冲突时自动重新分配，相同标题则更新' },
    { name: '✅ 访问统计', desc: '统计数据：覆盖导入历史访问记录' },
    { name: '❌ 用户信息', desc: '跳过导入：避免覆盖当前登录账号和密码' },
    { name: '❌ 站点信息', desc: '跳过导入：保留当前的站点名称、描述、Logo等配置' },
  ];

  return (
    <Card title="数据备份与恢复">
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="备份说明"
        description={
          <div>
            <p><strong>数据安全：</strong>导入时会自动跳过用户信息和站点信息，确保不会覆盖当前登录账号和站点配置。</p>
            <p><strong>图片文件：</strong>备份仅包含图片记录索引，不包含实际图片文件。本地图床请在"图床设置"中单独导出。</p>
            <p><strong>增量导入：</strong>文章等内容数据采用智能增量导入，ID冲突时自动重新分配，避免数据覆盖。</p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>📤 导出数据范围</Title>
        <List
          size="small"
          dataSource={exportDataTypes}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong style={{ color: '#52c41a' }}>{item.name}</Text>}
                description={item.desc}
              />
            </List.Item>
          )}
          style={{ 
            background: '#f6ffed', 
            padding: '16px', 
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #b7eb8f'
          }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>📥 导入处理策略</Title>
        <List
          size="small"
          dataSource={importDataTypes}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong style={{ color: item.name.startsWith('❌') ? '#ff4d4f' : '#1890ff' }}>{item.name}</Text>}
                description={item.desc}
              />
            </List.Item>
          )}
          style={{ 
            background: '#f0f5ff', 
            padding: '16px', 
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid #91d5ff'
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
          <li><Text strong>导出安全：</Text>备份文件包含所有内容数据，但不包含登录信息，可安全分享</li>
          <li><Text strong>导入安全：</Text>导入时会自动保护您的登录账号和站点配置不被覆盖</li>
          <li><Text strong>智能合并：</Text>定制化代码采用增量导入，不会清空现有的CSS/JS代码</li>
          <li><Text strong>图片处理：</Text>仅备份图片索引，实际图片文件需要单独备份文件系统</li>
          <li><Text strong>数据完整：</Text>导入时会自动重建分类关系，处理ID冲突</li>
          <li><Text strong>建议操作：</Text>导入前建议先备份当前数据，测试环境先验证</li>
          <li><Text strong style={{ color: '#ff4d4f' }}>危险操作：</Text>清空数据无法撤销，执行前务必备份！</li>
        </ul>
      </div>
    </Card>
  );
}
