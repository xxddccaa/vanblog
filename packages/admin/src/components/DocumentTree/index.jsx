import { Tree, Button, Dropdown, Modal, message } from 'antd';
import { 
  FileTextOutlined, 
  FolderOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  MoreOutlined,
  FileAddOutlined,
  ExportOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { getDocumentTree, getLibraries, deleteDocument, exportLibraryDocuments, deleteLibrary } from '@/services/van-blog/api';
import NewDocumentModal from '../NewDocumentModal';
import EditLibraryModal from '../EditLibraryModal';
import './index.less';

export default function DocumentTree(props) {
  const { onNodeSelect, selectedDocumentId, onRefresh } = props;
  const [treeData, setTreeData] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocType, setNewDocType] = useState('document');
  const [parentDocument, setParentDocument] = useState(null);
  const [showEditLibraryModal, setShowEditLibraryModal] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  // 获取文档库列表
  const fetchLibraries = async () => {
    try {
      const { data } = await getLibraries();
      setLibraries(data || []);
    } catch (error) {
      message.error('获取文档库列表失败');
    }
  };

  // 获取文档树数据
  const fetchTreeData = async () => {
    setLoading(true);
    try {
      const { data } = await getDocumentTree();
      const formattedData = formatTreeData(data || []);
      setTreeData(formattedData);
      
      // 默认展开所有文档库
      const libraryKeys = (data || [])
        .filter(item => item.type === 'library')
        .map(item => item.id.toString());
      setExpandedKeys(libraryKeys);
    } catch (error) {
      message.error('获取文档树失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化树数据
  const formatTreeData = (documents) => {
    return documents.map(doc => {
      const hasChildren = doc.children && doc.children.length > 0;
      const node = {
        key: doc.id.toString(),
        title: renderTreeNode(doc),
        // 移除icon属性，因为我们在renderTreeNode中已经包含了图标
        isLeaf: !hasChildren, // 只有当真正有子节点时才显示展开符号
        ...doc,
      };
      
      // 如果有子文档，递归处理
      if (hasChildren) {
        node.children = formatTreeData(doc.children);
      }
      
      return node;
    });
  };

    // 渲染树节点
  const renderTreeNode = (doc) => {
    return (
      <div 
        className="document-tree-node"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          width: '100%',
          paddingRight: '4px',
          minWidth: 0, // 允许收缩
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          showContextMenu(e, doc);
        }}
      >
        <div 
          className="document-tree-node-title"
          style={{ 
            cursor: 'pointer',
            flex: 1,
            minWidth: 0, // 允许收缩
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onClick={() => handleNodeClick(doc)}
          title={doc.title} // 添加title属性，鼠标悬停时显示完整标题
        >
          {/* 根据文档类型显示不同的图标 */}
          {doc.type === 'library' ? (
            <FolderOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
          ) : (
            <FileTextOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
          )}
          <span 
            style={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: '8px',
            }}
          >
            {doc.title}
          </span>
        </div>
        <div 
          className="document-tree-node-actions"
          style={{ 
            display: 'flex', 
            gap: '2px',
            flexShrink: 0, // 不允许收缩
            alignItems: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 根据文档类型显示不同的按钮 */}
          {doc.type === 'library' ? (
            // 文档库只显示更多操作按钮
            <Dropdown
              menu={getNodeMenu(doc)}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button 
                type="text" 
                size="small" 
                icon={<MoreOutlined />}
                title="更多操作"
                style={{ padding: '0 4px' }}
              />
            </Dropdown>
          ) : (
            // 文档显示编辑和更多操作按钮
            <>
              <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined />}
                onClick={() => handleEditDocument(doc)}
                title="编辑"
                style={{ padding: '0 4px' }}
              />
              <Dropdown
                menu={getNodeMenu(doc)}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button 
                  type="text" 
                  size="small" 
                  icon={<MoreOutlined />}
                  title="更多操作"
                  style={{ padding: '0 4px' }}
                />
              </Dropdown>
            </>
          )}
        </div>
      </div>
    );
  };

  // 获取节点菜单
  const getNodeMenu = (doc) => {
    const items = [];

    if (doc.type === 'library') {
      items.push({
        key: 'add-document',
        label: '新建文档',
        icon: <FileAddOutlined />,
        onClick: () => handleAddDocument(doc),
      });
      items.push({
        key: 'export-library',
        label: '导出文档库',
        icon: <ExportOutlined />,
        onClick: () => handleExportLibrary(doc),
      });
      items.push({
        key: 'edit-library',
        label: '修改信息',
        icon: <InfoCircleOutlined />,
        onClick: () => handleEditLibrary(doc),
      });
      items.push({
        key: 'delete-library',
        label: '删除文档库',
        icon: <DeleteOutlined />,
        onClick: () => handleDeleteLibrary(doc),
      });
    } else {
      items.push({
        key: 'add-subdocument',
        label: '新建子文档',
        icon: <FileAddOutlined />,
        onClick: () => handleAddSubDocument(doc),
      });
      items.push({
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        onClick: () => handleDeleteDocument(doc),
      });
    }

    return { items };
  };

  // 处理节点点击
  const handleNodeClick = (doc) => {
    // 点击文档名字直接预览，不展开子文档
    // 通知父组件
    if (onNodeSelect) {
      onNodeSelect(doc, 'view');
    }
  };

  // 显示右键菜单
  const showContextMenu = (event, doc) => {
    // 这里可以添加右键菜单逻辑，暂时使用默认的下拉菜单
  };

  // 处理添加文档
  const handleAddDocument = (library) => {
    setParentDocument(library);
    setNewDocType('document');
    setShowNewDocModal(true);
  };

  // 处理添加子文档
  const handleAddSubDocument = (parentDoc) => {
    setParentDocument(parentDoc);
    setNewDocType('document');
    setShowNewDocModal(true);
  };

  // 处理导出文档库
  const handleExportLibrary = async (library) => {
    try {
      setExportLoading(true);
      const response = await exportLibraryDocuments(library.id);
      
      // 处理导出数据
      const exportData = response.data;
      
      // 动态导入JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // 添加每个文档为单独的Markdown文件
      exportData.documents.forEach(doc => {
        zip.file(doc.fileName, doc.content);
      });
      
      // 添加一个README文件，包含文档库信息
      const readmeContent = `# ${exportData.libraryTitle}\n\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n包含 ${exportData.documents.length} 个文档文件。\n\n## 文档列表\n\n${exportData.documents.map(doc => `- ${doc.fileName} (${doc.originalTitle})`).join('\n')}`;
      zip.file('README.md', readmeContent);
      
      // 生成zip文件
      const content = await zip.generateAsync({type: 'blob'});
      
      // 创建下载链接
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${library.title}_文档库.zip`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      message.success(`文档库导出成功，包含 ${exportData.documents.length} 个文档`);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    } finally {
      setExportLoading(false);
    }
  };

  // 处理编辑文档库
  const handleEditLibrary = (library) => {
    setEditingLibrary(library);
    setShowEditLibraryModal(true);
  };

  // 处理删除文档库
  const handleDeleteLibrary = (library) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除文档库"${library.title}"吗？此操作将删除该文档库及其所有子文档，且无法恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteLibrary(library.id);
          message.success('文档库删除成功');
          fetchTreeData();
          onRefresh?.();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 已移除handleViewDocument函数，点击文档名字直接预览

  // 处理编辑文档
  const handleEditDocument = (doc) => {
    if (doc.type !== 'library' && onNodeSelect) {
      onNodeSelect(doc, 'edit');
    }
  };

  // 处理删除文档
  const handleDeleteDocument = (doc) => {
    Modal.confirm({
      title: `确定删除${doc.type === 'library' ? '文档库' : '文档'} "${doc.title}" 吗？`,
      content: doc.type === 'library' ? '删除文档库将会同时删除其下的所有文档！' : '此操作无法撤销！',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteDocument(doc.id);
          message.success('删除成功');
          // 自动刷新数据
          await fetchTreeData();
          // 通知父组件刷新
          if (onRefresh) {
            onRefresh();
          }
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 处理树节点选择
  const handleTreeSelect = (selectedKeys, info) => {
    if (selectedKeys.length > 0) {
      if (onNodeSelect) {
        onNodeSelect(info.node, 'select');
      }
    }
  };

  // 对外暴露的刷新方法
  const refreshTreeData = async () => {
    await fetchTreeData();
  };

  // 处理展开/收起
  const handleExpand = (expandedKeys) => {
    setExpandedKeys(expandedKeys);
  };

  // 刷新数据
  const handleRefresh = async () => {
    await fetchTreeData();
    await fetchLibraries();
    if (onRefresh) {
      onRefresh();
    }
  };

  useEffect(() => {
    fetchTreeData();
    fetchLibraries();
  }, []);

  return (
    <div className="document-tree-container">
      <div className="document-tree-header">
        <NewDocumentModal
          type="library"
          onFinish={async (data) => {
            // 先刷新本地数据
            await handleRefresh();
            // 再通知父组件刷新
            if (onRefresh) {
              await onRefresh();
            }
            // 如果创建了新文档库，自动选中它
            if (data && data.type === 'library' && onNodeSelect) {
              setTimeout(() => {
                onNodeSelect(data, 'view');
              }, 200);
            }
          }}
        />
      </div>

      <div className="document-tree-tree-wrapper">
        <div className="document-tree-content document-tree-scroll">
          <Tree
            showIcon={false}
            blockNode
            loading={loading}
            treeData={treeData}
            selectedKeys={selectedDocumentId ? [selectedDocumentId.toString()] : []}
            expandedKeys={expandedKeys}
            onSelect={handleTreeSelect}
            onExpand={handleExpand}
            titleRender={renderTreeNode}
            style={{ fontSize: '14px' }}
          />
        </div>
      </div>

      {/* 新建文档模态框 */}
      <Modal
        title="新建文档"
        open={showNewDocModal}
        onCancel={() => setShowNewDocModal(false)}
        footer={null}
      >
        <NewDocumentModal
          type={newDocType}
          libraries={libraries}
          parentId={parentDocument?.type === 'document' ? parentDocument.id : null}
          libraryId={parentDocument?.type === 'library' ? parentDocument.id : parentDocument?.library_id}
          onFinish={async (data) => {
            setShowNewDocModal(false);
            // 强制刷新树数据
            await fetchTreeData();
            await fetchLibraries();
            // 通知父组件刷新
            if (onRefresh) {
              await onRefresh();
            }
            // 如果创建了新文档，自动选中它并展开父节点
            if (data && data.type === 'document' && onNodeSelect) {
              // 确保父节点被展开
              if (data.parent_id) {
                setExpandedKeys(prev => [...new Set([...prev, data.parent_id.toString()])]);
              }
              if (data.library_id) {
                setExpandedKeys(prev => [...new Set([...prev, data.library_id.toString()])]);
              }
              setTimeout(() => {
                onNodeSelect(data, 'edit');
              }, 500);
            }
          }}
        />
      </Modal>

      {/* 编辑文档库模态框 */}
      <EditLibraryModal
        visible={showEditLibraryModal}
        library={editingLibrary}
        onCancel={() => {
          setShowEditLibraryModal(false);
          setEditingLibrary(null);
        }}
        onFinish={async () => {
          setShowEditLibraryModal(false);
          setEditingLibrary(null);
          // 刷新树数据
          await fetchTreeData();
          await fetchLibraries();
          if (onRefresh) {
            await onRefresh();
          }
        }}
      />
    </div>
  );
} 