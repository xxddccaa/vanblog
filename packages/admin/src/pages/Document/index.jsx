import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Button, Drawer, Space, Spin, message } from 'antd';
import {
  EditOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import DocumentViewer from '@/components/DocumentViewer';
import DocumentTree from '@/components/DocumentTree';
import NewDocumentModal from '@/components/NewDocumentModal';
import ContentSearchModal from '@/components/ContentSearchModal';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { getDocumentById, getLibraries, getSiteInfo } from '@/services/van-blog/api';
import './index.less';

export default function Document() {
  const { mobile } = useAdminResponsive();
  const [currentDocument, setCurrentDocument] = useState(null);
  const [documentContent, setDocumentContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [libraries, setLibraries] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(() => {
    const saved = localStorage.getItem('document-tree-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [showContentSearch, setShowContentSearch] = useState(false);
  const [siteInfo, setSiteInfo] = useState(null);
  const [treeDrawerOpen, setTreeDrawerOpen] = useState(false);
  const [treeRefreshNonce, setTreeRefreshNonce] = useState(0);

  const selectLibraryContext = useCallback((library) => {
    setCurrentDocument(library);
    setDocumentContent('');
    setSelectedDocumentId(library.id);
  }, []);

  const fetchSiteInfo = useCallback(async () => {
    try {
      const { data } = await getSiteInfo();
      setSiteInfo(data);
    } catch (error) {
      console.error('获取站点配置失败:', error);
    }
  }, []);

  const fetchLibraries = useCallback(async () => {
    try {
      const { data } = await getLibraries();
      setLibraries(data || []);
    } catch (error) {
      console.error('获取文档库列表失败:', error);
    }
  }, []);

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

  const handleSearchSelect = useCallback(
    async (item) => {
      if (item.type === 'library') {
        selectLibraryContext(item);
      } else {
        await loadDocument(item.id);
      }

      if (mobile) {
        setTreeDrawerOpen(false);
      }
      setShowContentSearch(false);
    },
    [loadDocument, mobile, selectLibraryContext],
  );

  const handleDocumentSelect = useCallback(
    async (item, action) => {
      if (item.type === 'library') {
        selectLibraryContext(item);
        if (mobile) {
          setTreeDrawerOpen(false);
        }
        return;
      }

      if (action === 'edit') {
        history.push(`/editor?type=document&id=${item.id}`);
        return;
      }

      await loadDocument(item.id);
      if (mobile) {
        setTreeDrawerOpen(false);
      }
    },
    [loadDocument, mobile, selectLibraryContext],
  );

  const refreshTree = useCallback(() => {
    setTreeRefreshNonce((value) => value + 1);
  }, []);

  const handleRefresh = useCallback(async () => {
    await fetchLibraries();
    refreshTree();
    if (currentDocument?.type === 'document' && currentDocument?.id) {
      await loadDocument(currentDocument.id);
    }
  }, [currentDocument, fetchLibraries, loadDocument, refreshTree]);

  const handleNewDocumentFinish = useCallback(
    async (data) => {
      await fetchLibraries();
      refreshTree();

      if (data?.type === 'library') {
        selectLibraryContext(data);
      } else if (data?.type === 'document') {
        history.push(`/editor?type=document&id=${data.id}`);
      }

      if (mobile) {
        setTreeDrawerOpen(false);
      }
    },
    [fetchLibraries, mobile, refreshTree, selectLibraryContext],
  );

  const toggleTreeCollapse = useCallback(() => {
    setIsTreeCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('document-tree-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsTreeCollapsed(true);
        localStorage.setItem('document-tree-collapsed', 'true');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleTreeCollapse();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleTreeCollapse]);

  useEffect(() => {
    fetchSiteInfo();
    fetchLibraries();
  }, [fetchLibraries, fetchSiteInfo]);

  const currentTypeLabel = useMemo(() => {
    if (!currentDocument) return '未选择';
    return currentDocument.type === 'library' ? '文档库' : '文档';
  }, [currentDocument]);

  const railMetaLabel = useMemo(
    () => `${libraries.length} 个文档库 · Ctrl/Cmd + B 收起`,
    [libraries.length],
  );

  const mobileMetaLabel = useMemo(() => {
    if (!currentDocument) {
      return `${libraries.length} 个文档库 · 从文档树进入`;
    }

    return `${currentTypeLabel} · ${currentDocument.title}`;
  }, [currentDocument, currentTypeLabel, libraries.length]);

  const renderSelectionActions = (compact = false) => {
    if (!currentDocument) {
      return (
        <Space size={compact ? 8 : 10} wrap>
          <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
            内容搜索
          </Button>
          <NewDocumentModal
            type="library"
            onFinish={handleNewDocumentFinish}
            buttonText="新建文档库"
            buttonProps={{ type: 'primary' }}
          />
        </Space>
      );
    }

    if (currentDocument.type === 'library') {
      return (
        <Space size={compact ? 8 : 10} wrap>
          <NewDocumentModal
            type="document"
            libraries={libraries}
            libraryId={currentDocument.id}
            onFinish={handleNewDocumentFinish}
            buttonText="新建文档"
            buttonProps={{ type: 'primary' }}
          />
          <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
            内容搜索
          </Button>
        </Space>
      );
    }

    return (
      <Space size={compact ? 8 : 10} wrap>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => history.push(`/editor?type=document&id=${currentDocument.id}`)}
        >
          编辑
        </Button>
        <NewDocumentModal
          type="document"
          libraries={libraries}
          parentId={currentDocument.id}
          libraryId={currentDocument.library_id}
          onFinish={handleNewDocumentFinish}
          buttonText="新建子文档"
          buttonProps={{ type: 'default' }}
        />
      </Space>
    );
  };

  const renderEmptyState = (mobileMode = false) => (
    <div className={['document-empty-state', mobileMode ? 'document-empty-state-mobile' : ''].filter(Boolean).join(' ')}>
      <div className="document-empty-state__eyebrow">预览区</div>
      <div className="document-empty-state__title">先选择一篇文档</div>
      <div className="document-empty-state__desc">
        从左侧文档树或内容搜索进入，先看内容，再决定是否进入编辑器。这里始终只保留当前上下文，阅读会更安静。
      </div>
      <div className="document-empty-state__note">支持树状浏览、内容搜索和直接新建文档库。</div>
      <div className="document-empty-state__actions">{renderSelectionActions(mobileMode)}</div>
    </div>
  );

  const renderLibraryOverview = (mobileMode = false) => (
    <div className={['document-library-panel', mobileMode ? 'document-library-panel-mobile' : ''].filter(Boolean).join(' ')}>
      <div className="document-library-panel__eyebrow">文档库概览</div>
      <div className="document-library-panel__title">{currentDocument.title}</div>
      <div className="document-library-panel__desc">
        {currentDocument.description || currentDocument.content || '这个文档库还没有补充描述，可以先创建文档，再逐步补全说明。'}
      </div>
      <div className="document-library-panel__note">从文档树继续浏览，或直接在这个文档库下新建文档。</div>
    </div>
  );

  const renderStageBody = (mobileMode = false) => {
    if (!currentDocument) {
      return renderEmptyState(mobileMode);
    }

    if (currentDocument.type === 'library') {
      return renderLibraryOverview(mobileMode);
    }

    return (
      <div className={['document-stage-viewer', mobileMode ? 'document-stage-viewer-mobile' : ''].filter(Boolean).join(' ')}>
        <DocumentViewer
          value={documentContent}
          codeMaxLines={siteInfo?.codeMaxLines || 15}
          themeConfig={siteInfo}
        />
      </div>
    );
  };

  const renderStageHeader = (mobileMode = false) => {
    const showTreeButton = !mobileMode && isTreeCollapsed;

    return (
      <div className={['document-stage-header', mobileMode ? 'document-stage-header-mobile' : ''].filter(Boolean).join(' ')}>
        <div className="document-stage-heading">
          {showTreeButton ? (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              className="document-stage-tree-toggle"
              onClick={() => (mobileMode ? setTreeDrawerOpen(true) : toggleTreeCollapse())}
            />
          ) : null}
          <div className="document-stage-title-group">
            <div className="document-stage-title-row">
              <div className="document-stage-title">{currentDocument?.title || '未选择文档'}</div>
              <span className="document-stage-type-pill">{currentTypeLabel}</span>
            </div>
            <div className="document-stage-subtitle">
              {currentDocument
                ? currentDocument.type === 'library'
                  ? '浏览这个文档库的概览与结构。'
                  : '当前为预览模式，可随时进入编辑器继续修改。'
                : '从文档树或搜索进入后，这里只展示当前上下文。'}
            </div>
          </div>
        </div>
        <div className="document-stage-actions">{currentDocument ? renderSelectionActions(mobileMode) : null}</div>
      </div>
    );
  };

  const renderDesktopWorkspace = () => (
    <div className={['document-workspace', isTreeCollapsed ? 'document-workspace-collapsed' : ''].filter(Boolean).join(' ')}>
      {!isTreeCollapsed ? (
        <aside className="document-rail">
          <div className="document-rail-header">
            <div className="document-rail-title-row">
              <div>
                <div className="document-rail-title">文档树</div>
                <div className="document-rail-meta">{railMetaLabel}</div>
              </div>
              <Button
                type="text"
                icon={<MenuFoldOutlined />}
                className="document-rail-toggle"
                onClick={toggleTreeCollapse}
                title="收起文档树 (Ctrl/Cmd + B)"
              />
            </div>
            <div className="document-rail-actions">
              <NewDocumentModal
                type="library"
                onFinish={handleNewDocumentFinish}
                buttonText="新建文档库"
                buttonProps={{ type: 'primary' }}
              />
              <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
                内容搜索
              </Button>
            </div>
          </div>
          <div className="document-rail-tree-shell">
            <DocumentTree
              refreshNonce={treeRefreshNonce}
              onNodeSelect={handleDocumentSelect}
              selectedDocumentId={selectedDocumentId}
              onRefresh={handleRefresh}
            />
          </div>
        </aside>
      ) : null}

      <section className="document-stage-shell">
        {renderStageHeader()}
        <div className="document-stage-body">
          <Spin spinning={loading}>{renderStageBody()}</Spin>
        </div>
      </section>
    </div>
  );

  const renderMobileWorkspace = () => (
    <>
      <Drawer
        title="文档树"
        placement="left"
        width="100vw"
        className="document-mobile-drawer"
        open={treeDrawerOpen}
        onClose={() => setTreeDrawerOpen(false)}
      >
        <div className="document-mobile-drawer-toolbar">
          <NewDocumentModal
            type="library"
            onFinish={handleNewDocumentFinish}
            buttonText="新建文档库"
            buttonProps={{ type: 'primary', block: true }}
          />
          <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
            内容搜索
          </Button>
        </div>
        <div className="document-mobile-tree-shell">
          <DocumentTree
            mobile
            refreshNonce={treeRefreshNonce}
            onNodeSelect={handleDocumentSelect}
            selectedDocumentId={selectedDocumentId}
            onRefresh={handleRefresh}
          />
        </div>
      </Drawer>

      <div className="document-mobile-bar">
        <div>
          <div className="document-mobile-bar__title">私密文档</div>
          <div className="document-mobile-bar__meta">{mobileMetaLabel}</div>
        </div>
        <div className="document-mobile-bar__actions">
          <Button icon={<MenuUnfoldOutlined />} onClick={() => setTreeDrawerOpen(true)}>
            文档树
          </Button>
          <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)} />
        </div>
      </div>

      <section className="document-mobile-stage-shell">
        {renderStageHeader(true)}
        <div className="document-mobile-stage-body">
          <Spin spinning={loading}>{renderStageBody(true)}</Spin>
        </div>
      </section>
    </>
  );

  return (
    <PageContainer title={mobile ? false : '私密文档'} className="document-page-container">
      {mobile ? renderMobileWorkspace() : renderDesktopWorkspace()}
      <ContentSearchModal
        visible={showContentSearch}
        onCancel={() => setShowContentSearch(false)}
        type="document"
        onSelect={handleSearchSelect}
      />
    </PageContainer>
  );
}
