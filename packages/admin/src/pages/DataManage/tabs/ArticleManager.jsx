import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Modal,
  Table,
  Alert,
  Spin,
  Typography,
  Progress,
} from 'antd';
import { ExclamationCircleOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { getArticlesByOption, cleanupDuplicatePathnames } from '@/services/van-blog/api';
import { request } from 'umi';

const { Title, Text } = Typography;

export default function ArticleManager() {
  const [loading, setLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupPathnameLoading, setCleanupPathnameLoading] = useState(false);
  const [articles, setArticles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [reorderProgress, setReorderProgress] = useState('');

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      // 获取所有文章，不分页
      const { data } = await getArticlesByOption({
        page: 1,
        pageSize: 99999,
        sortCreatedAt: 'asc', // 按创建时间升序排列
      });
      setArticles(data?.articles || []);
    } catch (error) {
      message.error('获取文章列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleReorderArticles = async () => {
    Modal.confirm({
      title: '⚠️ 危险操作确认',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      width: 600,
      content: (
        <div>
          <Alert
            type="error"
            showIcon
            message="此操作存在风险！"
            description="文章序号重排会修改所有文章的ID，可能导致外部链接失效。"
            style={{ margin: '16px 0' }}
          />
          <p><Text strong>此操作将执行以下步骤：</Text></p>
          <ul>
            <li>将所有文章按创建时间顺序重新分配ID（从1开始）</li>
            <li>自动更新文章内容中的相互引用链接（/post/数字 格式）</li>
            <li>更新文章的浏览量统计关联</li>
            <li>清理增量渲染缓存</li>
          </ul>
          <Alert
            type="warning"
            message="注意事项"
            description="所有文章（包括自定义路径文章）都会参与ID重排，以确保ID的连续性。自定义路径文章仍可通过其自定义路径访问。"
            style={{ marginTop: 16 }}
          />
          <p style={{ marginTop: 16, color: '#ff4d4f' }}>
            <Text strong>建议在执行前先备份数据！</Text>
          </p>
        </div>
      ),
      okText: '我确认要执行重排',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await executeReorder();
      }
    });
  };

  const executeReorder = async () => {
    setReorderLoading(true);
    setProgress(0);
    
    try {
      setReorderProgress('正在分析文章数据...');
      setProgress(10);
      
      // 调用后端API执行重排
      const result = await request('/api/admin/article/reorder', {
        method: 'POST',
      });
      
      if (result.statusCode === 200) {
        setProgress(100);
        setReorderProgress('重排完成！');
        
        Modal.success({
          title: '文章序号重排成功！',
          content: (
            <div>
              <p>重排统计：</p>
              <ul>
                <li>处理文章数量：{result.data.totalArticles} 篇</li>
                <li>更新引用链接：{result.data.updatedReferences} 处</li>
                <li>自定义路径文章：{result.data.customPathArticles} 篇</li>
              </ul>
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
        throw new Error(result.message || '重排失败');
      }
    } catch (error) {
      message.error('重排失败：' + (error?.message || '网络错误'));
      setProgress(0);
      setReorderProgress('');
    } finally {
      setReorderLoading(false);
    }
  };

  const handleFixNegativeIds = async () => {
    Modal.confirm({
      title: '修复负数ID',
      content: '检测到有文章的ID为负数，这可能是由于上次重排操作未完成导致的。是否现在修复这些负数ID？',
      onOk: async () => {
        setFixLoading(true);
        try {
          const result = await request('/api/admin/article/fix-negative-ids', {
            method: 'POST',
          });
          
          if (result.statusCode === 200) {
            message.success(`修复成功！共修复 ${result.data.fixedCount} 篇文章的ID`);
            fetchArticles(); // 刷新列表
          } else {
            message.error(result.message || '修复失败');
          }
        } catch (error) {
          message.error('修复失败：' + (error?.message || '网络错误'));
        } finally {
          setFixLoading(false);
        }
      }
    });
  };

  const handleCleanupTempIds = async () => {
    const tempIdArticles = articles.filter(a => a.id >= 50000);
    
    if (tempIdArticles.length === 0) {
      message.info('没有发现需要清理的临时ID文章');
      return;
    }
    
    Modal.confirm({
      title: '清理临时ID文章',
      content: (
        <div>
          <p>检测到 {tempIdArticles.length} 篇文章的ID在临时范围（50000+），这些文章可能是重排过程中产生的冲突数据。</p>
          <p><Text strong>将要清理的文章：</Text></p>
          <ul>
            {tempIdArticles.slice(0, 5).map(article => (
              <li key={article.id}>ID {article.id}: {article.title}</li>
            ))}
            {tempIdArticles.length > 5 && <li>... 还有 {tempIdArticles.length - 5} 篇</li>}
          </ul>
          <Alert 
            type="warning" 
            message="注意：清理操作不可逆，建议先确认这些确实是不需要的文章" 
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      onOk: async () => {
        setCleanupLoading(true);
        try {
          const result = await request('/api/admin/article/cleanup-temp-ids', {
            method: 'POST',
          });
          
          if (result.statusCode === 200) {
            message.success(`清理成功！共删除 ${result.data.cleanedCount} 篇临时ID文章`);
            fetchArticles(); // 刷新列表
          } else {
            message.error(result.message || '清理失败');
          }
        } catch (error) {
          message.error('清理失败：' + (error?.message || '网络错误'));
        } finally {
          setCleanupLoading(false);
        }
      }
    });
  };

  const handleCleanupDuplicatePathnames = async () => {
    // 检查是否有重复的自定义路径名
    const pathnameCount = {};
    const articlesWithPathname = articles.filter(a => a.pathname && a.pathname.trim());
    
    articlesWithPathname.forEach(article => {
      const pathname = article.pathname.trim();
      if (!pathnameCount[pathname]) {
        pathnameCount[pathname] = [];
      }
      pathnameCount[pathname].push(article);
    });
    
    const duplicatePathnames = Object.entries(pathnameCount).filter(([_, articles]) => articles.length > 1);
    
    if (duplicatePathnames.length === 0) {
      message.info('没有发现重复的自定义路径名');
      return;
    }
    
    Modal.confirm({
      title: '清理重复的自定义路径名',
      width: 600,
      content: (
        <div>
          <Alert
            type="warning"
            showIcon
            message="发现重复的自定义路径名"
            description={`检测到 ${duplicatePathnames.length} 个重复的自定义路径名，涉及 ${duplicatePathnames.reduce((sum, [_, articles]) => sum + articles.length, 0)} 篇文章。`}
            style={{ marginBottom: 16 }}
          />
          <p><Text strong>重复的路径名：</Text></p>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {duplicatePathnames.map(([pathname, duplicateArticles]) => (
              <div key={pathname} style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>路径名: {pathname}</Text>
                <div style={{ marginTop: 8 }}>
                  {duplicateArticles.map(article => (
                    <div key={article.id} style={{ marginLeft: 16 }}>
                      <Text>ID {article.id}: {article.title}</Text>
                      {article === duplicateArticles[0] && (
                        <Text type="success" style={{ marginLeft: 8 }}>(将保留)</Text>
                      )}
                      {article !== duplicateArticles[0] && (
                        <Text type="warning" style={{ marginLeft: 8 }}>(将清除路径名)</Text>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Alert 
            type="info" 
            message="清理规则" 
            description="对于每个重复的路径名，系统将保留创建时间最早的文章的自定义路径名，其他文章的自定义路径名将被清除（改为使用ID访问）。" 
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      onOk: async () => {
        setCleanupPathnameLoading(true);
        try {
          const result = await cleanupDuplicatePathnames();
          
          if (result.statusCode === 200) {
            message.success(result.message || `清理成功！共处理 ${result.data.cleanedCount} 篇文章的重复路径名`);
            fetchArticles(); // 刷新列表
          } else {
            message.error(result.message || '清理失败');
          }
        } catch (error) {
          message.error('清理失败：' + (error?.message || '网络错误'));
        } finally {
          setCleanupPathnameLoading(false);
        }
      }
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '路径',
      key: 'path',
      width: 200,
      render: (text, record) => {
        const path = record.pathname || record.id;
        return (
          <Text code>/post/{path}</Text>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (text, record) => {
        return record.pathname ? (
          <Text type="success">自定义路径</Text>
        ) : (
          <Text>使用ID</Text>
        );
      },
    },
  ];

  // 统计信息
  const stats = {
    totalArticles: articles.length,
    customPathArticles: articles.filter(a => a.pathname).length,
    idBasedArticles: articles.filter(a => !a.pathname).length,
    negativeIdArticles: articles.filter(a => a.id < 0).length,
    tempIdArticles: articles.filter(a => a.id >= 50000).length,
  };

  // 检查重复的自定义路径名
  const pathnameCount = {};
  articles.filter(a => a.pathname && a.pathname.trim()).forEach(article => {
    const pathname = article.pathname.trim();
    if (!pathnameCount[pathname]) {
      pathnameCount[pathname] = [];
    }
    pathnameCount[pathname].push(article);
  });
  const duplicatePathnames = Object.entries(pathnameCount).filter(([_, articles]) => articles.length > 1);
  stats.duplicatePathnameCount = duplicatePathnames.length;
  stats.duplicatePathnameArticleCount = duplicatePathnames.reduce((sum, [_, articles]) => sum + articles.length, 0);

  return (
    <Card title="文章序号重排">
      <Alert
        type="info"
        showIcon
        message="功能说明"
        description={
          <div>
            <p><strong>文章序号重排：</strong>将所有文章按创建时间顺序重新分配ID，从1开始连续排列。</p>
            <p><strong>智能引用更新：</strong>自动检测和更新文章内容中的相互引用链接（如/post/123格式）。</p>
            <p><strong>兼容性保证：</strong>自定义路径文章参与ID重排但保持其自定义路径可访问性。</p>
            <p><strong>全量渲染：</strong>重排完成后自动触发全量静态页面重新生成，确保所有链接正确。</p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />

      <div style={{ marginBottom: 24 }}>
        <Title level={5}>📊 文章统计</Title>
        <Space size="large">
          <div>
            <Text strong>总文章数：</Text>
            <Text style={{ fontSize: '18px', color: '#1890ff' }}>{stats.totalArticles}</Text>
          </div>
          <div>
            <Text strong>使用ID访问：</Text>
            <Text style={{ fontSize: '18px', color: '#52c41a' }}>{stats.idBasedArticles}</Text>
          </div>
                     <div>
             <Text strong>自定义路径：</Text>
             <Text style={{ fontSize: '18px', color: '#fa8c16' }}>{stats.customPathArticles}</Text>
           </div>
           {stats.negativeIdArticles > 0 && (
             <div>
               <Text strong>异常ID：</Text>
               <Text style={{ fontSize: '18px', color: '#ff4d4f' }}>{stats.negativeIdArticles}</Text>
             </div>
           )}
           {stats.tempIdArticles > 0 && (
             <div>
               <Text strong>临时ID：</Text>
               <Text style={{ fontSize: '18px', color: '#ff7a00' }}>{stats.tempIdArticles}</Text>
             </div>
           )}
           {stats.duplicatePathnameCount > 0 && (
             <div>
               <Text strong>重复路径名：</Text>
               <Text style={{ fontSize: '18px', color: '#ff4d4f' }}>{stats.duplicatePathnameCount}组/{stats.duplicatePathnameArticleCount}篇</Text>
             </div>
           )}
         </Space>
       </div>

       {stats.negativeIdArticles > 0 && (
         <Alert
           type="error"
           showIcon
           message="检测到异常数据"
           description={`发现 ${stats.negativeIdArticles} 篇文章的ID为负数，这可能是由于上次重排操作未完成导致的。建议先修复这些异常ID再进行重排。`}
           style={{ marginBottom: 20 }}
         />
       )}

       {stats.tempIdArticles > 0 && (
         <Alert
           type="warning"
           showIcon
           message="检测到临时ID文章"
           description={`发现 ${stats.tempIdArticles} 篇文章的ID在临时范围（50000+），这些可能是重排过程中的冲突数据。建议先清理这些临时ID文章。`}
           style={{ marginBottom: 20 }}
         />
       )}

       {stats.duplicatePathnameCount > 0 && (
         <Alert
           type="error"
           showIcon
           message="检测到重复的自定义路径名"
           description={`发现 ${stats.duplicatePathnameCount} 组重复的自定义路径名，涉及 ${stats.duplicatePathnameArticleCount} 篇文章。这会导致路径冲突，建议立即清理。`}
           style={{ marginBottom: 20 }}
         />
       )}

      {reorderLoading && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <Progress percent={progress} status="active" />
            <p style={{ marginTop: 16 }}>{reorderProgress}</p>
          </div>
        </Card>
      )}

             <div style={{ marginBottom: 24 }}>
         <Space>
           {stats.negativeIdArticles > 0 && (
             <Button
               type="primary"
               icon={<SortAscendingOutlined />}
               onClick={handleFixNegativeIds}
               loading={fixLoading}
             >
               修复异常ID
             </Button>
           )}
           {stats.tempIdArticles > 0 && (
             <Button
               type="primary"
               onClick={handleCleanupTempIds}
               loading={cleanupLoading}
             >
               清理临时ID ({stats.tempIdArticles}篇)
             </Button>
           )}
           {stats.duplicatePathnameCount > 0 && (
             <Button
               type="primary"
               danger
               onClick={handleCleanupDuplicatePathnames}
               loading={cleanupPathnameLoading}
             >
               清理重复路径名 ({stats.duplicatePathnameCount}组)
             </Button>
           )}
           <Button
             type="primary"
             danger
             icon={<SortAscendingOutlined />}
             onClick={handleReorderArticles}
             loading={reorderLoading}
             disabled={stats.totalArticles === 0 || stats.negativeIdArticles > 0 || stats.tempIdArticles > 0}
           >
             执行文章序号重排
           </Button>
           <Button onClick={fetchArticles} loading={loading}>
             刷新列表
           </Button>
         </Space>
       </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={articles}
          rowKey="id"
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `共 ${total} 篇文章，显示第 ${range[0]}-${range[1]} 篇`,
          }}
          scroll={{ x: 800 }}
        />
      </Spin>

      <div style={{ marginTop: 24, padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
        <Title level={5}>⚠️ 重要提醒</Title>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><Text strong>数据安全：</Text>执行重排前建议先备份数据库</li>
          <li><Text strong>外部影响：</Text>重排会改变文章ID，可能影响外部链接和书签</li>
          <li><Text strong>SEO影响：</Text>搜索引擎已索引的链接可能需要重新索引</li>
          <li><Text strong>自定义路径：</Text>自定义路径文章参与重排但保持路径可访问性</li>
          <li><Text strong>引用更新：</Text>系统会自动更新文章内的相互引用链接</li>
          <li><Text strong>全量渲染：</Text>重排后会自动触发全量静态页面重新生成</li>
        </ul>
      </div>
    </Card>
  );
} 