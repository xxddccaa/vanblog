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
  SwapOutlined,
} from '@ant-design/icons';
import { useState, useEffect, useCallback } from 'react';
import {
  getDocumentTree,
  getLibraries,
  deleteDocument,
  exportLibraryDocuments,
  deleteLibrary,
} from '@/services/van-blog/api';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import NewDocumentModal from '../NewDocumentModal';
import EditLibraryModal from '../EditLibraryModal';
import EditDocumentModal from '../EditDocumentModal';
import ConvertToDraftModal from './ConvertToDraftModal';
import './index.less';

export default function DocumentTree(props) {
  const { onNodeSelect, selectedDocumentId, onRefresh, refreshNonce = 0 } = props;
  const { mobile } = useAdminResponsive();
  const [treeData, setTreeData] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocType, setNewDocType] = useState('document');
  const [parentDocument, setParentDocument] = useState(null);
  const [showEditLibraryModal, setShowEditLibraryModal] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [showConvertToDraftModal, setShowConvertToDraftModal] = useState(false);
  const [convertingDocument, setConvertingDocument] = useState(null);

  const fetchLibraries = useCallback(async () => {
    try {
      const { data } = await getLibraries();
      setLibraries(data || []);
    } catch (error) {
      console.error('获取文档库列表失败:', error);
    }
  }, []);

  const fetchTreeData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDocumentTree();
      const source = data || [];
      setTreeData(
        source.map((item) => ({
          ...item,
          key: item.id.toString(),
          title: item.title,
          children: item.children?.length
            ? item.children.map(function mapChildren(child) {
                return {
                  ...child,
                  key: child.id.toString(),
                  title: child.title,
                  children: child.children?.length ? child.children.map(mapChildren) : undefined,
                  isLeaf: !child.children?.length,
                };
              })
            : undefined,
          isLeaf: !item.children?.length,
        })),
      );

      setExpandedKeys((prev) => {
        if (prev.length) return prev;
        return source.filter((item) => item.type === 'library').map((item) => item.id.toString());
      });
    } catch (error) {
      message.error('获取文档树失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddDocument = (library) => {
    setParentDocument(library);
    setNewDocType('document');
    setShowNewDocModal(true);
  };

  const handleAddSubDocument = (parentDoc) => {
    setParentDocument(parentDoc);
    setNewDocType('document');
    setShowNewDocModal(true);
  };

  const handleExportLibrary = async (library) => {
    try {
      const response = await exportLibraryDocuments(library.id);
      const exportData = response.data;
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      exportData.documents.forEach((doc) => {
        zip.file(doc.fileName, doc.content);
      });

      const readmeContent = `# ${exportData.libraryTitle}\n\n导出时间：${new Date().toLocaleString('zh-CN')}\n\n包含 ${exportData.documents.length} 个文档文件。\n\n## 文档列表\n\n${exportData.documents
        .map((doc) => `- ${doc.fileName} (${doc.originalTitle})`)
        .join('\n')}`;
      zip.file('README.md', readmeContent);

      const content = await zip.generateAsync({ type: 'blob' });
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
    }
  };

  const handleEditLibrary = (library) => {
    setEditingLibrary(library);
    setShowEditLibraryModal(true);
  };

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
          await fetchTreeData();
          onRefresh?.();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleEditDocument = (doc) => {
    if (doc.type !== 'library') {
      onNodeSelect?.(doc, 'edit');
    }
  };

  const handleEditDocumentInfo = (doc) => {
    setEditingDocument(doc);
    setShowEditDocumentModal(true);
  };

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
          await fetchTreeData();
          onRefresh?.();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleConvertToDraft = (doc) => {
    setConvertingDocument(doc);
    setShowConvertToDraftModal(true);
  };

  const handleConvertToDraftSuccess = async () => {
    setShowConvertToDraftModal(false);
    setConvertingDocument(null);
    await fetchTreeData();
    await fetchLibraries();
    onRefresh?.();
  };

  const handleRefresh = useCallback(async () => {
    await fetchTreeData();
    await fetchLibraries();
    onRefresh?.();
  }, [fetchLibraries, fetchTreeData, onRefresh]);

  const getNodeMenu = (doc) => {
    const items = [];

    if (doc.type === 'library') {
      items.push(
        {
          key: 'add-document',
          label: '新建文档',
          icon: <FileAddOutlined />,
          onClick: () => handleAddDocument(doc),
        },
        {
          key: 'export-library',
          label: '导出文档库',
          icon: <ExportOutlined />,
          onClick: () => handleExportLibrary(doc),
        },
        {
          key: 'edit-library',
          label: '修改信息',
          icon: <InfoCircleOutlined />,
          onClick: () => handleEditLibrary(doc),
        },
        {
          key: 'delete-library',
          label: '删除文档库',
          icon: <DeleteOutlined />,
          onClick: () => handleDeleteLibrary(doc),
        },
      );
    } else {
      items.push(
        {
          key: 'add-subdocument',
          label: '新建子文档',
          icon: <FileAddOutlined />,
          onClick: () => handleAddSubDocument(doc),
        },
        {
          key: 'edit-document-info',
          label: '修改信息',
          icon: <InfoCircleOutlined />,
          onClick: () => handleEditDocumentInfo(doc),
        },
      );

      if (!doc.children?.length) {
        items.push({
          key: 'convert-to-draft',
          label: '转为草稿',
          icon: <SwapOutlined />,
          onClick: () => handleConvertToDraft(doc),
        });
      }

      items.push({
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        onClick: () => handleDeleteDocument(doc),
      });
    }

    return { items };
  };

  const renderTreeNode = (doc) => {
    const isSelected = String(selectedDocumentId || '') === String(doc.id);

    return (
      <div
        className={[
          'document-tree-node',
          doc.type === 'library' ? 'document-tree-node-library' : 'document-tree-node-document',
          isSelected ? 'document-tree-node-selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button className="document-tree-node-title" type="button" onClick={() => onNodeSelect?.(doc, 'view')}>
          <span className="document-tree-node-icon">
            {doc.type === 'library' ? <FolderOutlined /> : <FileTextOutlined />}
          </span>
          <span className="document-tree-node-text">{doc.title}</span>
        </button>

        <div className="document-tree-node-actions" onClick={(event) => event.stopPropagation()}>
          {doc.type === 'library' || mobile ? null : (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditDocument(doc)}
              title="编辑"
              className="document-tree-node-action"
            />
          )}
          <Dropdown menu={getNodeMenu(doc)} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              title="更多操作"
              className="document-tree-node-action"
            />
          </Dropdown>
        </div>
      </div>
    );
  };

  useEffect(() => {
    fetchTreeData();
    fetchLibraries();
  }, [fetchLibraries, fetchTreeData, refreshNonce]);

  return (
    <div className={['document-tree-container', mobile ? 'document-tree-container-mobile' : ''].filter(Boolean).join(' ')}>
      <div className="document-tree-tree-wrapper">
        <div className="document-tree-content document-tree-scroll">
          <Tree
            showIcon={false}
            selectable={false}
            blockNode
            loading={loading}
            treeData={treeData}
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            titleRender={renderTreeNode}
            className="document-tree-control"
          />
        </div>
      </div>

      <Modal title="新建文档" open={showNewDocModal} onCancel={() => setShowNewDocModal(false)} footer={null}>
        <NewDocumentModal
          type={newDocType}
          libraries={libraries}
          parentId={parentDocument?.type === 'document' ? parentDocument.id : null}
          libraryId={parentDocument?.type === 'library' ? parentDocument.id : parentDocument?.library_id}
          onFinish={async (data) => {
            setShowNewDocModal(false);
            await fetchTreeData();
            await fetchLibraries();
            await onRefresh?.();
            if (data?.type === 'document' && onNodeSelect) {
              if (data.parent_id) {
                setExpandedKeys((prev) => [...new Set([...prev, data.parent_id.toString()])]);
              }
              if (data.library_id) {
                setExpandedKeys((prev) => [...new Set([...prev, data.library_id.toString()])]);
              }
              setTimeout(() => {
                onNodeSelect(data, 'edit');
              }, 300);
            }
          }}
        />
      </Modal>

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
          await handleRefresh();
        }}
      />

      <EditDocumentModal
        visible={showEditDocumentModal}
        document={editingDocument}
        onCancel={() => {
          setShowEditDocumentModal(false);
          setEditingDocument(null);
        }}
        onFinish={async () => {
          setShowEditDocumentModal(false);
          setEditingDocument(null);
          await handleRefresh();
        }}
      />

      <ConvertToDraftModal
        visible={showConvertToDraftModal}
        document={convertingDocument}
        onCancel={() => {
          setShowConvertToDraftModal(false);
          setConvertingDocument(null);
        }}
        onOk={handleConvertToDraftSuccess}
      />
    </div>
  );
}
