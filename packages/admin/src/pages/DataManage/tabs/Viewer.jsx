import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  InputNumber,
  Button,
  Space,
  message,
  Modal,
  Table,
  Statistic,
  Alert,
  Tooltip,
  Divider,
} from 'antd';
import { ProForm, ProFormGroup, ProFormDigit } from '@ant-design/pro-components';
import {
  getViewerData,
  updateSiteViewer,
  updateArticleViewer,
  autoBoostViewer,
} from '@/services/van-blog/viewer';

export default function ViewerManagement() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [autoBoostForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result } = await getViewerData();
      setData(result);
      // 重置表单数据到最新值
      form.setFieldsValue(result.site);
    } catch (error) {
      message.error('获取浏览量数据失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 当数据加载完成后，设置表单初始值
  useEffect(() => {
    if (data?.site) {
      form.setFieldsValue(data.site);
    }
  }, [data?.site, form]);

  const handleUpdateSite = async (values) => {
    try {
      await updateSiteViewer(values);
      message.success('网站浏览量更新成功');
      fetchData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleUpdateArticle = async (article, viewer, visited) => {
    try {
      await updateArticleViewer({
        id: article.id,
        viewer,
        visited,
      });
      message.success(`文章"${article.title}"浏览量更新成功`);
      fetchData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleAutoBoost = async (values) => {
    Modal.confirm({
      title: '确认智能提升浏览量',
      content: (
        <div>
          <p>即将对所有文章进行浏览量提升：</p>
          <p>• 每篇文章增加 {values.minIncrease} - {values.maxIncrease} 次访问</p>
          <p>• 网站总浏览量倍数：{values.siteMultiplier}</p>
          <p style={{ color: '#ff4d4f' }}>此操作不可撤销，请确认是否继续？</p>
        </div>
      ),
      onOk: async () => {
        try {
          setLoading(true);
          const { data: result } = await autoBoostViewer(values);
          message.success(
            `浏览量提升完成！共更新 ${result.articlesUpdated} 篇文章，总计增加 ${result.totalViewerIncrease} 次访问`
          );
          fetchData();
        } catch (error) {
          message.error('智能提升失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const articleColumns = [
    {
      title: '文章标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
    },
    {
      title: '访问量',
      dataIndex: 'viewer',
      key: 'viewer',
      width: 120,
      render: (text, record) => (
        <InputNumber
          min={0}
          value={text}
          size="small"
          onBlur={(e) => {
            const newValue = parseInt(e.target.value) || 0;
            if (newValue !== text) {
              handleUpdateArticle(record, newValue, record.visited);
            }
          }}
          onChange={() => {
            // 允许用户输入，但不立即更新状态
          }}
        />
      ),
    },
    {
      title: '访客数',
      dataIndex: 'visited',
      key: 'visited',
      width: 120,
      render: (text, record) => (
        <InputNumber
          min={0}
          value={text}
          size="small"
          onBlur={(e) => {
            const newValue = parseInt(e.target.value) || 0;
            if (newValue !== text) {
              handleUpdateArticle(record, record.viewer, newValue);
            }
          }}
          onChange={() => {
            // 允许用户输入，但不立即更新状态
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              const increase = Math.floor(Math.random() * 50) + 10;
              const visitorIncrease = Math.floor(increase * 0.6);
              handleUpdateArticle(
                record,
                record.viewer + increase,
                record.visited + visitorIncrease
              );
            }}
          >
            随机提升
          </Button>
        </Space>
      ),
    },
  ];

  if (!data) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <Alert
        message="浏览量管理说明"
        description="网站总浏览量和文章浏览量是独立统计的。网站总浏览量包含首页、关于页面等所有页面的访问，不是文章浏览量的简单累加。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16}>
        <Col span={12}>
          <Card title="网站总浏览量" bordered={false}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="总访问量" value={data.site.viewer} />
              </Col>
              <Col span={12}>
                <Statistic title="总访客数" value={data.site.visited} />
              </Col>
            </Row>
            <Divider />
            <ProForm
              form={form}
              layout="horizontal"
              onFinish={handleUpdateSite}
              submitter={{
                searchConfig: {
                  submitText: '更新网站浏览量',
                },
                resetButtonProps: false,
              }}
            >
              <ProFormGroup>
                <ProFormDigit
                  name="viewer"
                  label="访问量"
                  min={0}
                  fieldProps={{ precision: 0 }}
                  rules={[{ required: true, message: '请输入访问量' }]}
                />
                <ProFormDigit
                  name="visited"
                  label="访客数"
                  min={0}
                  fieldProps={{ precision: 0 }}
                  rules={[{ required: true, message: '请输入访客数' }]}
                />
              </ProFormGroup>
            </ProForm>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="智能提升浏览量" bordered={false}>
            <ProForm
              form={autoBoostForm}
              layout="horizontal"
              initialValues={{
                minIncrease: 10,
                maxIncrease: 100,
                siteMultiplier: 1.5,
                articlesOnly: false,
              }}
              onFinish={handleAutoBoost}
              submitter={{
                searchConfig: {
                  submitText: '开始智能提升',
                },
                resetButtonProps: false,
                submitButtonProps: {
                  type: 'primary',
                  danger: true,
                },
              }}
            >
              <ProFormGroup>
                <ProFormDigit
                  name="minIncrease"
                  label="最小增量"
                  min={1}
                  max={1000}
                  fieldProps={{ precision: 0 }}
                  tooltip="每篇文章最少增加的访问量"
                />
                <ProFormDigit
                  name="maxIncrease"
                  label="最大增量"
                  min={1}
                  max={1000}
                  fieldProps={{ precision: 0 }}
                  tooltip="每篇文章最多增加的访问量"
                />
              </ProFormGroup>
              <ProFormDigit
                name="siteMultiplier"
                label="网站倍数"
                min={0.1}
                max={10}
                fieldProps={{ precision: 1, step: 0.1 }}
                tooltip="网站总浏览量相对于文章增量的倍数"
              />
            </ProForm>
          </Card>
        </Col>
      </Row>

      <Card
        title={`文章浏览量管理 (共 ${data.articles.length} 篇)`}
        style={{ marginTop: 16 }}
      >
        <Table
          columns={articleColumns}
          dataSource={data.articles}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 篇文章`,
          }}
          scroll={{ y: 400 }}
        />
      </Card>
    </div>
  );
} 