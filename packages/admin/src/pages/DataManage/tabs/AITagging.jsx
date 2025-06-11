import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Button,
  Space,
  message,
  Modal,
  Table,
  Tag,
  Select,
  Divider,
  Alert,
  Spin,
  Typography,
} from 'antd';
import { ProForm, ProFormGroup, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { PlusOutlined, DeleteOutlined, RobotOutlined, EditOutlined } from '@ant-design/icons';
import {
  getAITaggingConfig,
  updateAITaggingConfig,
  getArticlesForTagging,
  generateAITags,
  updateArticleTags,
  triggerISR,
} from '@/services/van-blog/ai-tagging';

const { TextArea } = Input;
const { Text } = Typography;

// 默认配置
const defaultConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  temperature: 0.8,
  topP: 0.8,
  maxTokens: 150,
  conversations: [
    {
      role: 'system',
      content: '你是一位专业的SEO内容策略师，擅长为博客文章生成高相关性的标签（Tags），帮助提升搜索可见性和用户体验。'
    },
    {
      role: 'user',
      content: '任务：根据我提供的文章内容（或主题），生成3-5个最合适的标签。要求：精准性：标签必须与内容强相关，避免泛泛而谈；SEO优化：优先包含长尾关键词；多样性：覆盖文章的子主题；格式：用英文逗号分隔，全部为小写（示例：python数据分析, pandas教程, 数据可视化），除了标签不要回答额外的话语，免得我不好读懂。优先给中文标签，但是也可以中英文混合。'
    },
    {
      role: 'assistant',
      content: '好的，我理解了。我会根据文章内容生成3-5个精准的、SEO友好的标签，格式为用英文逗号分隔的小写标签，并且不回答额外的话语只是回答标签。请提供文章内容。'
    },
    {
      role: 'user',
      content: '文章内容：{content}'
    }
  ]
};

export default function AITagging() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [editingTags, setEditingTags] = useState({});
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchCancelled, setBatchCancelled] = useState(false);
  const [isrLoading, setIsrLoading] = useState(false);

  // 获取配置
  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await getAITaggingConfig();
      if (data) {
        setConfig(data);
        form.setFieldsValue(data);
      } else {
        form.setFieldsValue(defaultConfig);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
      form.setFieldsValue(defaultConfig);
    }
  }, [form]);

  // 获取文章列表
  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await getArticlesForTagging();
      setArticles(data);
    } catch (error) {
      message.error('获取文章列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchArticles();
  }, [fetchConfig, fetchArticles]);

  // 保存配置
  const handleSaveConfig = async (values) => {
    try {
      await updateAITaggingConfig(values);
      setConfig(values);
      message.success('配置保存成功');
    } catch (error) {
      message.error('配置保存失败');
    }
  };

  // 添加对话
  const addConversation = () => {
    const conversations = form.getFieldValue('conversations') || [];
    const newConversations = [...conversations, { role: 'user', content: '' }];
    form.setFieldsValue({ conversations: newConversations });
  };

  // 删除对话
  const removeConversation = (index) => {
    const conversations = form.getFieldValue('conversations') || [];
    const newConversations = conversations.filter((_, i) => i !== index);
    form.setFieldsValue({ conversations: newConversations });
  };

  // 生成AI标签
  const handleGenerateTags = async (article) => {
    try {
      setGeneratingTags(true);
      setSelectedArticle(article);
      
      // 构造请求内容
      const conversations = config.conversations.map(conv => ({
        ...conv,
        content: conv.content.replace('{content}', `标题：${article.title}\n内容：${article.content || ''}`)
      }));

      const { data } = await generateAITags({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        topP: config.topP,
        maxTokens: config.maxTokens,
        conversations
      });

      // 解析标签，去除前后空格并过滤空字符串
      const tags = data.split(',').map(tag => tag.trim()).filter(tag => tag && tag.length > 0);
      
      // 更新文章标签（单个文章打标时触发ISR）
      await updateArticleTags(article.id, tags, false);
      
      // 更新本地状态
      setArticles(prevArticles => 
        prevArticles.map(a => 
          a.id === article.id ? { ...a, tags } : a
        )
      );
      
      message.success(`为文章"${article.title}"生成标签成功`);
      
      // 延迟刷新文章列表以确保数据同步
      setTimeout(() => {
        fetchArticles();
      }, 1000);
    } catch (error) {
      message.error('AI标签生成失败：' + (error.message || '未知错误'));
    } finally {
      setGeneratingTags(false);
      setSelectedArticle(null);
    }
  };

  // 手动编辑标签
  const handleEditTags = (article, tags) => {
    setEditingTags({ ...editingTags, [article.id]: tags || [] });
  };

  // 保存编辑的标签
  const handleSaveTags = async (article) => {
    try {
      const tags = editingTags[article.id] || [];
      
      // 手动编辑标签时触发ISR
      await updateArticleTags(article.id, tags, false);
      
      // 更新本地状态
      setArticles(prevArticles => 
        prevArticles.map(a => 
          a.id === article.id ? { ...a, tags } : a
        )
      );
      
      // 清除编辑状态
      const newEditingTags = { ...editingTags };
      delete newEditingTags[article.id];
      setEditingTags(newEditingTags);
      
      message.success('标签保存成功');
      
      // 延迟刷新文章列表以确保数据同步
      setTimeout(() => {
        fetchArticles();
      }, 1000);
    } catch (error) {
      message.error('标签保存失败');
    }
  };

  // 取消编辑
  const handleCancelEdit = (articleId) => {
    const newEditingTags = { ...editingTags };
    delete newEditingTags[articleId];
    setEditingTags(newEditingTags);
  };

  // 取消批量打标
  const handleCancelBatch = () => {
    setBatchCancelled(true);
  };

  // 手动触发ISR渲染
  const handleTriggerISR = async () => {
    setIsrLoading(true);
    try {
      await triggerISR();
      message.success('页面渲染已触发！需要一些时间生效。');
    } catch (error) {
      message.error('触发渲染失败');
    } finally {
      setIsrLoading(false);
    }
  };

  // 批量为无标签文章打标
  const handleBatchGenerateTags = async () => {
    const articlesWithoutTags = articles.filter(article => !article.tags || article.tags.length === 0);
    
    if (articlesWithoutTags.length === 0) {
      message.info('没有找到无标签的文章');
      return;
    }

    Modal.confirm({
      title: '批量AI打标',
      content: (
        <div>
          <p>确定要为 <strong>{articlesWithoutTags.length} 篇</strong> 无标签文章进行AI打标吗？</p>
          <div style={{ background: '#f6f6f6', padding: '12px', borderRadius: '6px', marginTop: '12px' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#d46b08' }}>⚠️ 重要提示：</p>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>此操作 <strong>无法撤销</strong>，每篇文章打标后立即生效</li>
              <li>如果中途关闭网页，已处理的文章标签会保留，未处理的文章会停止</li>
              <li>整个过程可能需要 {Math.ceil(articlesWithoutTags.length / 60)} - {Math.ceil(articlesWithoutTags.length / 30)} 分钟</li>
              <li>建议在网络稳定的环境下执行，避免中途中断</li>
            </ul>
          </div>
        </div>
      ),
      width: 500,
      onOk: async () => {
        setBatchGenerating(true);
        setBatchCancelled(false);
        setBatchProgress({ current: 0, total: articlesWithoutTags.length });
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < articlesWithoutTags.length; i++) {
          // 检查是否用户取消了操作
          if (batchCancelled) {
            message.info(`批量打标已取消。已处理 ${successCount} 篇文章。`);
            break;
          }
          
          const article = articlesWithoutTags[i];
          setBatchProgress({ current: i + 1, total: articlesWithoutTags.length });
          try {
            // 构造请求内容
            const conversations = config.conversations.map(conv => ({
              ...conv,
              content: conv.content.replace('{content}', `标题：${article.title}\n内容：${article.content || ''}`)
            }));

            const { data } = await generateAITags({
              baseUrl: config.baseUrl,
              apiKey: config.apiKey,
              model: config.model,
              temperature: config.temperature,
              topP: config.topP,
              maxTokens: config.maxTokens,
              conversations
            });

            // 解析标签，去除前后空格并过滤空字符串
            const tags = data.split(',').map(tag => tag.trim()).filter(tag => tag && tag.length > 0);
            
            // 更新文章标签（批量操作时跳过ISR）
            await updateArticleTags(article.id, tags, true);
            
            // 更新本地状态
            setArticles(prevArticles => 
              prevArticles.map(a => 
                a.id === article.id ? { ...a, tags } : a
              )
            );
            
            successCount++;
            
            // 添加延迟避免频繁请求
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`文章 ${article.id} 打标失败:`, error);
            failCount++;
          }
        }

        setBatchGenerating(false);
        setBatchProgress({ current: 0, total: 0 });
        setBatchCancelled(false);
        
        if (!batchCancelled) {
          message.success(`批量打标完成！成功：${successCount} 篇，失败：${failCount} 篇`);
        }
        
        // 刷新文章列表
        fetchArticles();
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '文章标题',
      dataIndex: 'title',
      width: 300,
      render: (text) => (
        <div style={{ wordBreak: 'break-word', lineHeight: '1.5' }}>
          {text}
        </div>
      ),
    },
    {
      title: '当前标签',
      dataIndex: 'tags',
      width: 300,
      render: (tags, record) => {
        const isEditing = editingTags.hasOwnProperty(record.id);
        
        if (isEditing) {
          return (
            <div>
              <Select
                mode="tags"
                tokenSeparators={[',']}
                style={{ width: '100%' }}
                placeholder="请选择或输入标签，回车确认"
                value={editingTags[record.id]}
                onChange={(value) => setEditingTags({ ...editingTags, [record.id]: value })}
                size="small"
                open={false} // 不显示下拉选项，只作为标签输入器
              />
              <div style={{ marginTop: 4 }}>
                <Button 
                  size="small" 
                  type="primary" 
                  onClick={() => handleSaveTags(record)}
                  style={{ marginRight: 4 }}
                >
                  保存
                </Button>
                <Button 
                  size="small" 
                  onClick={() => handleCancelEdit(record.id)}
                >
                  取消
                </Button>
              </div>
            </div>
          );
        }
        
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              {tags && tags.length > 0 ? (
                tags.map(tag => (
                  <Tag key={tag} style={{ marginBottom: 2, marginRight: 4 }}>
                    {tag}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">暂无标签</Text>
              )}
            </div>
            <Button 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEditTags(record, tags || [])}
            >
              编辑
            </Button>
          </div>
        );
      },
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          icon={<RobotOutlined />}
          size="small"
          loading={generatingTags && selectedArticle?.id === record.id}
          onClick={() => handleGenerateTags(record)}
          disabled={!config.apiKey}
        >
          AI打标
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="AI打标功能说明"
        description={
          <div>
            <p>配置好AI服务后，可以为文章智能生成标签。生成的标签可以手动编辑修改。请确保API密钥有效且有足够的额度。</p>
            <p><strong>性能优化：</strong>批量打标过程中不会触发页面渲染，避免性能问题。批量完成后请手动点击"手动触发渲染"按钮更新前台页面。</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 配置区域 */}
      <Card title="AI配置" style={{ marginBottom: 16 }}>
        <ProForm
          form={form}
          layout="vertical"
          onFinish={handleSaveConfig}
          initialValues={config}
          submitter={{
            searchConfig: {
              submitText: '保存配置',
            },
            resetButtonProps: false,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="baseUrl"
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                rules={[{ required: true, message: '请输入Base URL' }]}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="apiKey"
                label="API Key"
                placeholder="sk-..."
                rules={[{ required: true, message: '请输入API Key' }]}
              />
            </Col>
          </Row>

          <Divider>模型参数</Divider>
          
          <Row gutter={16}>
            <Col span={6}>
              <ProFormText
                name="model"
                label="模型名称"
                placeholder="gpt-4o"
                rules={[{ required: true, message: '请输入模型名称' }]}
                tooltip="指定要使用的AI模型，如 gpt-4o, gpt-3.5-turbo 等"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="temperature"
                label="Temperature"
                placeholder="0.8"
                rules={[
                  { required: true, message: '请输入Temperature' },
                  {
                    validator: (_, value) => {
                      const num = parseFloat(value);
                      if (isNaN(num) || num < 0 || num > 2) {
                        return Promise.reject('请输入0-2之间的数字');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
                tooltip="控制输出的随机性，0-2之间，越高越随机"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="topP"
                label="Top P"
                placeholder="0.8"
                rules={[
                  { required: true, message: '请输入Top P' },
                  {
                    validator: (_, value) => {
                      const num = parseFloat(value);
                      if (isNaN(num) || num < 0 || num > 1) {
                        return Promise.reject('请输入0-1之间的数字');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
                tooltip="核采样参数，0-1之间，控制考虑的词汇范围"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="maxTokens"
                label="Max Tokens"
                placeholder="150"
                rules={[
                  { required: true, message: '请输入Max Tokens' },
                  {
                    validator: (_, value) => {
                      const num = parseInt(value);
                      if (isNaN(num) || num < 1 || num > 4096) {
                        return Promise.reject('请输入1-4096之间的整数');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
                tooltip="生成文本的最大长度，建议150以内以控制成本"
              />
            </Col>
          </Row>

          <Divider>对话配置</Divider>
          
          <Form.List name="conversations">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 8 }}
                    extra={
                      fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      )
                    }
                  >
                    <Row gutter={16}>
                      <Col span={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'role']}
                          label="角色"
                          rules={[{ required: true, message: '请选择角色' }]}
                        >
                          <Select>
                            <Select.Option value="system">System</Select.Option>
                            <Select.Option value="user">User</Select.Option>
                            <Select.Option value="assistant">Assistant</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={20}>
                        <Form.Item
                          {...restField}
                          name={[name, 'content']}
                          label="内容"
                          rules={[{ required: true, message: '请输入内容' }]}
                        >
                          <TextArea 
                            rows={3} 
                            placeholder="请输入对话内容，在user角色中可以使用{content}占位符代表文章内容"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ role: 'user', content: '' })}
                  block
                  icon={<PlusOutlined />}
                >
                  添加对话
                </Button>
              </>
            )}
          </Form.List>
        </ProForm>
      </Card>

      {/* 文章列表 */}
      <Card 
        title={`文章列表 (共 ${articles.length} 篇)`}
        extra={
          <Space>
            {batchGenerating && (
              <Button
                danger
                onClick={handleCancelBatch}
                disabled={batchCancelled}
              >
                {batchCancelled ? '正在取消...' : '取消批量打标'}
              </Button>
            )}
            <Button
              onClick={handleTriggerISR}
              loading={isrLoading}
              disabled={batchGenerating}
            >
              手动触发渲染
            </Button>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              loading={batchGenerating}
              onClick={handleBatchGenerateTags}
              disabled={!config.apiKey || batchGenerating}
            >
              {batchGenerating 
                ? `批量打标中 (${batchProgress.current}/${batchProgress.total})` 
                : '批量为无标签文章打标'
              }
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={articles}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 篇文章`,
          }}
          scroll={{ y: 500 }}
        />
      </Card>
    </div>
  );
} 