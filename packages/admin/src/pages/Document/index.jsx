import { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Row, Col, Card, Button, Space, message } from 'antd';
import { 
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { history } from 'umi';
import DocumentViewer from '@/components/DocumentViewer';
import DocumentTree from '@/components/DocumentTree';
import NewDocumentModal from '@/components/NewDocumentModal';
import { 
  getDocumentById, 
  getLibraries,
  createDocument,
} from '@/services/van-blog/api';
import './index.less';

export default function Document() {
  const [currentDocument, setCurrentDocument] = useState(null);
  const [documentContent, setDocumentContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [libraries, setLibraries] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(() => {
    const saved = localStorage.getItem('document-tree-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem('document-tree-width');
    return saved ? parseInt(saved) : 6; // 默认宽度为6个栅格
  });
  const [isResizing, setIsResizing] = useState(false);

  // 获取文档库列表
  const fetchLibraries = async () => {
    try {
      const { data } = await getLibraries();
      setLibraries(data || []);
    } catch (error) {
      message.error('获取文档库列表失败');
    }
  };

  // 加载文档内容
  const loadDocument = useCallback(async (documentId) => {
    if (!documentId) return;
    
    setLoading(true);
    try {
      const { data } = await getDocumentById(documentId);
      setCurrentDocument(data);
      setDocumentContent(data?.content || '');
      setSelectedDocumentId(documentId);
    } catch (error) {
      message.error('加载文档失败');
    } finally {
      setLoading(false);
    }
  }, []);



  // 处理文档树节点选择
  const handleDocumentSelect = async (document, action) => {
    if (document.type === 'library') {
      // 如果是文档库，只显示信息，不加载内容
      setCurrentDocument(document);
      setDocumentContent('');
      setSelectedDocumentId(document.id);
      return;
    }

    // 处理文档
    if (action === 'edit') {
      // 跳转到编辑页面
      history.push(`/editor?type=document&id=${document.id}`);
    } else {
      // 默认为查看模式
      await loadDocument(document.id);
    }
  };





  // 刷新页面
  const handleRefresh = async () => {
    await fetchLibraries();
    if (currentDocument?.id) {
      await loadDocument(currentDocument.id);
    }
  };

  // 处理新建文档完成后的回调
  const handleNewDocumentFinish = useCallback(async (data) => {
    // 先刷新本地数据
    await fetchLibraries();
    
    // 如果创建的是文档，自动跳转到编辑页面
    if (data && data.type === 'document') {
      history.push(`/editor?type=document&id=${data.id}`);
    }
    
    // 通知DocumentTree组件刷新
    handleRefresh();
  }, [handleRefresh]);

  // 切换文档树收起/展开状态
  const toggleTreeCollapse = () => {
    const newCollapsed = !isTreeCollapsed;
    setIsTreeCollapsed(newCollapsed);
    localStorage.setItem('document-tree-collapsed', JSON.stringify(newCollapsed));
  };

  // 处理拖拽调整宽度
  const handleMouseDown = (e) => {
    if (isTreeCollapsed) return;
    setIsResizing(true);
    e.preventDefault();
  };

  // 双击重置宽度
  const handleDoubleClick = () => {
    if (isTreeCollapsed) return;
    setTreeWidth(6);
    localStorage.setItem('document-tree-width', '6');
  };

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || isTreeCollapsed) return;
    
    const containerRect = document.querySelector('.ant-row').getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;
    const newWidthPercent = (mouseX / containerWidth) * 24; // 转换为栅格系统的24分制
    
    // 限制宽度在3-12之间
    const clampedWidth = Math.min(Math.max(newWidthPercent, 3), 12);
    setTreeWidth(Math.round(clampedWidth));
  }, [isResizing, isTreeCollapsed]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      localStorage.setItem('document-tree-width', treeWidth.toString());
    }
    setIsResizing(false);
  }, [isResizing, treeWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 检测屏幕尺寸，在移动端自动收起文档树
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsTreeCollapsed(true);
        localStorage.setItem('document-tree-collapsed', 'true');
      }
    };

    // 初始检测
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + B 切换文档树显示状态
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleTreeCollapse();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTreeCollapsed]);

  useEffect(() => {
    fetchLibraries();
  }, []);

  const renderContent = () => {
    if (!currentDocument) {
      return (
        <Card 
          className="document-content-card" 
          style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ textAlign: 'center', color: '#999' }}>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>请选择一个文档进行查看或编辑</p>
            <p style={{ fontSize: '14px', color: '#ccc' }}>
              在左侧文档树中创建文档库和文档
            </p>
          </div>
        </Card>
      );
    }

    return (
      <Card 
        className="document-content-card"
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{currentDocument.title}</span>
            <Space>
              {currentDocument.type === 'document' && (
                <Button type="primary" icon={<EditOutlined />} onClick={() => history.push(`/editor?type=document&id=${currentDocument.id}`)}>
                  编辑
                </Button>
              )}

              {currentDocument.type === 'document' && (
                <NewDocumentModal
                  type="document"
                  libraries={libraries}
                  parentId={currentDocument.id}
                  libraryId={currentDocument.library_id}
                  onFinish={handleNewDocumentFinish}
                />
              )}
            </Space>
          </div>
        }
        style={{ minHeight: '600px', overflow: 'hidden' }}
        bodyStyle={{ minHeight: '543px', padding: '0', overflow: 'auto' }}
      >
        <div className="document-page-viewer">
          {currentDocument.type === 'library' ? (
            <div className="document-page-library-info">
              <h3>文档库: {currentDocument.title}</h3>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                {currentDocument.description || currentDocument.content || '暂无描述'}
              </p>
              <p style={{ color: '#999' }}>
                请从左侧文档树选择要查看的文档
              </p>
            </div>
          ) : (
            <DocumentViewer
              value={documentContent}
            />
          )}
        </div>
      </Card>
    );
  };

  return (
    <PageContainer
      title="私密文档"
      className="document-page-container"
      extra={
        <div style={{ color: '#666', fontSize: '12px' }}>
          快捷键：Ctrl/Cmd + B 切换文档树
        </div>
      }
    >
              <Row gutter={[16, 16]} style={{ minHeight: '600px' }}>
        {!isTreeCollapsed && (
          <Col 
            xs={{ span: 24, order: 1 }} 
            sm={{ span: 24, order: 1 }} 
            md={{ span: Math.min(treeWidth + 2, 12), order: 1 }} 
            lg={{ span: treeWidth, order: 1 }} 
            xl={{ span: treeWidth, order: 1 }}
            style={{ position: 'relative' }}
          >
            <Card 
              className="document-tree-card"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>文档树</span>
                                     <Button
                     type="text"
                     icon={<MenuFoldOutlined />}
                     size="small"
                     onClick={toggleTreeCollapse}
                     title="收起文档树 (Ctrl/Cmd + B)"
                   />
                </div>
              }
              style={{ 
                minHeight: '600px', 
                marginBottom: '16px' 
              }}
              bodyStyle={{ 
                minHeight: '543px', 
                padding: '16px',
                overflow: 'auto'
              }}
            >
              <DocumentTree
                onNodeSelect={handleDocumentSelect}
                selectedDocumentId={selectedDocumentId}
                onRefresh={handleRefresh}
              />
            </Card>
            {/* 拖拽调整宽度的手柄 */}
            <div
              className="resize-handle"
              onMouseDown={handleMouseDown}
              onDoubleClick={handleDoubleClick}
              style={{
                position: 'absolute',
                top: 0,
                right: -8,
                width: 16,
                height: '100%',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#bfbfbf',
                fontSize: '12px',
                backgroundColor: isResizing ? '#f0f0f0' : 'transparent',
                borderRadius: '4px',
                transition: 'background-color 0.2s ease',
              }}
              title="拖拽调整宽度，双击重置"
            >
              <DragOutlined />
              {isResizing && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '20px',
                    transform: 'translateY(-50%)',
                    background: '#1890ff',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    animation: 'fadeIn 0.2s ease',
                  }}
                >
                  宽度: {treeWidth}/24
                </div>
              )}
            </div>
          </Col>
        )}
        <Col 
          xs={{ span: 24, order: 2 }} 
          sm={{ span: 24, order: 2 }} 
          md={{ span: isTreeCollapsed ? 24 : Math.max(24 - treeWidth - 2, 12), order: 2 }} 
          lg={{ span: isTreeCollapsed ? 24 : 24 - treeWidth, order: 2 }} 
          xl={{ span: isTreeCollapsed ? 24 : 24 - treeWidth, order: 2 }}
          style={{ position: 'relative' }}
        >
                     {isTreeCollapsed && (
             <Button
               type="primary"
               icon={<MenuUnfoldOutlined />}
               size="small"
               onClick={toggleTreeCollapse}
               title="展开文档树 (Ctrl/Cmd + B)"
               style={{
                 position: 'absolute',
                 top: 16,
                 left: 16,
                 zIndex: 100,
                 boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
               }}
             />
           )}
          {renderContent()}
        </Col>
      </Row>
    </PageContainer>
  );
} 