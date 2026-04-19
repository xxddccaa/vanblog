import AdminMobileCardList from '@/components/AdminMobileCardList';
import ContentSearchModal from '@/components/ContentSearchModal';
import ConvertToDocumentModal from '@/components/ConvertToDocumentModal';
import ImportDraftModal from '@/components/ImportDraftModal';
import NewDraftModal from '@/components/NewDraftModal';
import PublishDraftModal from '@/components/PublishDraftModal';
import {
  deleteDraft,
  getAllCategories,
  getDraftById,
  getDraftsByOption,
  getSiteInfo,
  getTags,
} from '@/services/van-blog/api';
import { batchDelete, batchExport } from '@/services/van-blog/batch';
import { parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import useAdminResponsive from '@/services/van-blog/useAdminResponsive';
import { useNum } from '@/services/van-blog/useNum';
import { FilterOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Drawer,
  Dropdown,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
  Modal,
} from 'antd';
import RcResizeObserver from 'rc-resize-observer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { draftKeysObj, draftKeysObjSmall, getColumns } from './columes';

const MAX_DRAFT_PAGE_SIZE = 100;
const DEFAULT_DRAFT_PAGE_SIZE = 20;
const DRAFT_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
const DRAFT_PAGE_SIZE_STORAGE_KEY = 'van-blog-admin-num-draft-page-size';

const normalizeDraftPageSize = (value, fallback = DEFAULT_DRAFT_PAGE_SIZE) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 10), MAX_DRAFT_PAGE_SIZE);
};

const buildDraftListOption = ({ current, pageSize, filters = {}, sort = {}, defaultPageSize }) => {
  const option = {};

  if (sort.createdAt) {
    option.sortCreatedAt = sort.createdAt === 'ascend' ? 'asc' : 'desc';
  }
  if (sort.top) {
    option.sortTop = sort.top === 'ascend' ? 'asc' : 'desc';
  }

  if (filters.title?.trim()) {
    option.title = filters.title.trim();
  }
  if (filters.tags?.trim()) {
    option.tags = filters.tags.trim();
  }
  if (filters.startTime) {
    option.startTime = filters.startTime;
  }
  if (filters.endTime) {
    option.endTime = filters.endTime;
  }
  if (filters.category?.trim()) {
    option.category = filters.category.trim();
  }

  option.page = current;
  option.pageSize = normalizeDraftPageSize(pageSize, defaultPageSize);
  return option;
};

const exportDraftMarkdown = async (record) => {
  const { data: obj } = await getDraftById(record.id);
  const md = parseObjToMarkdown(obj);
  const data = new Blob([md]);
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${record.title}.md`;
  link.click();
};

export default () => {
  const { mobile } = useAdminResponsive();
  const actionRef = useRef();
  const [colKeys, setColKeys] = useState(draftKeysObj);
  const [simplePage, setSimplePage] = useState(false);
  const [simpleSearch, setSimpleSearch] = useState(false);
  const [defaultPageSize, setDefaultPageSize] = useState(DEFAULT_DRAFT_PAGE_SIZE);
  const [pageSize, setPageSize] = useNum(defaultPageSize, 'draft-page-size');
  const [showConvertToDocumentModal, setShowConvertToDocumentModal] = useState(false);
  const [convertingDraft, setConvertingDraft] = useState(null);
  const [showContentSearch, setShowContentSearch] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileRows, setMobileRows] = useState([]);
  const [mobileTotal, setMobileTotal] = useState(0);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [mobileFilters, setMobileFilters] = useState({
    title: '',
    category: undefined,
    tags: undefined,
  });
  const [mobileFilterDraft, setMobileFilterDraft] = useState({
    title: '',
    category: undefined,
    tags: undefined,
  });

  const handleSearchSelect = (draft) => {
    history.push(`/editor?type=draft&id=${draft.id}`);
  };

  const handleConvertToDocument = useCallback((draft) => {
    setConvertingDraft(draft);
    setShowConvertToDocumentModal(true);
  }, []);

  const handleConvertToDocumentSuccess = useCallback(() => {
    setShowConvertToDocumentModal(false);
    setConvertingDraft(null);
    if (mobile) {
      return;
    }
    actionRef.current?.reload();
  }, [mobile]);

  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const { data } = await getSiteInfo();
        const configuredPageSize = normalizeDraftPageSize(
          data?.adminDraftPageSize,
          DEFAULT_DRAFT_PAGE_SIZE,
        );
        setDefaultPageSize(configuredPageSize);
        const storedPageSize = localStorage.getItem(DRAFT_PAGE_SIZE_STORAGE_KEY);
        if (!storedPageSize) {
          setPageSize(configuredPageSize);
          return;
        }
        const normalizedStoredPageSize = normalizeDraftPageSize(storedPageSize, configuredPageSize);
        if (normalizedStoredPageSize !== parseInt(storedPageSize, 10)) {
          setPageSize(normalizedStoredPageSize);
        }
      } catch (error) {
        console.error('获取站点配置失败:', error);
      }
    };
    fetchSiteInfo();
  }, [setPageSize]);

  const searchSpan = useMemo(() => {
    if (!simpleSearch) {
      return 8;
    }
    return 24;
  }, [simpleSearch]);

  const columns = useMemo(() => {
    return getColumns(handleConvertToDocument);
  }, [handleConvertToDocument]);

  const fetchMobileMeta = useCallback(async () => {
    try {
      const [{ data: categoryData }, { data: tagData }] = await Promise.all([
        getAllCategories(),
        getTags(),
      ]);
      setCategories(categoryData || []);
      setTags(tagData || []);
    } catch (error) {
      message.error('加载移动端筛选项失败');
    }
  }, []);

  const fetchMobileDrafts = useCallback(async () => {
    if (!mobile) {
      return;
    }

    setMobileLoading(true);
    try {
      const option = buildDraftListOption({
        current: mobilePage,
        pageSize,
        filters: mobileFilters,
        defaultPageSize,
      });
      const { data } = await getDraftsByOption(option);
      setMobileRows(data?.drafts || []);
      setMobileTotal(data?.total || 0);
    } catch (error) {
      message.error('加载草稿列表失败');
    } finally {
      setMobileLoading(false);
    }
  }, [defaultPageSize, mobile, mobileFilters, mobilePage, pageSize]);

  useEffect(() => {
    if (!mobile) {
      return;
    }

    fetchMobileMeta();
  }, [fetchMobileMeta, mobile]);

  useEffect(() => {
    fetchMobileDrafts();
  }, [fetchMobileDrafts]);

  const reloadCurrentList = useCallback(() => {
    if (mobile) {
      fetchMobileDrafts();
      return;
    }

    actionRef.current?.reload();
  }, [fetchMobileDrafts, mobile]);

  const handleDeleteOne = useCallback(
    (record) => {
      Modal.confirm({
        title: `确定删除草稿 "${record.title}" 吗？`,
        onOk: async () => {
          await deleteDraft(record.id);
          message.success('删除成功!');
          reloadCurrentList();
          return true;
        },
      });
    },
    [reloadCurrentList],
  );

  const handleApplyMobileFilters = () => {
    setMobileFilters({
      title: mobileFilterDraft.title?.trim?.() || '',
      category: mobileFilterDraft.category,
      tags: mobileFilterDraft.tags,
    });
    setMobilePage(1);
    setMobileFilterOpen(false);
  };

  const handleResetMobileFilters = () => {
    const nextFilters = {
      title: '',
      category: undefined,
      tags: undefined,
    };
    setMobileFilters(nextFilters);
    setMobileFilterDraft(nextFilters);
    setMobilePage(1);
    setMobileFilterOpen(false);
  };

  const mobileFilterTags = [
    mobileFilters.category ? `分类: ${mobileFilters.category}` : null,
    mobileFilters.tags ? `标签: ${mobileFilters.tags}` : null,
  ].filter(Boolean);

  const renderMobileContent = () => (
    <>
      <Card className="admin-mobile-toolbar-card">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div className="admin-mobile-toolbar-title">草稿管理</div>
            <div className="admin-mobile-toolbar-subtitle">
              手机上优先处理筛选、发布和转文档等常用动作。
            </div>
          </div>
          <Input.Search
            allowClear
            enterButton="搜索标题"
            placeholder="输入草稿标题"
            value={mobileFilterDraft.title}
            onChange={(event) =>
              setMobileFilterDraft((state) => ({
                ...state,
                title: event.target.value,
              }))
            }
            onSearch={() => handleApplyMobileFilters()}
          />
          {mobileFilterTags.length ? (
            <Space wrap>
              {mobileFilterTags.map((item) => (
                <Tag key={item} color="blue">
                  {item}
                </Tag>
              ))}
            </Space>
          ) : null}
          <Space wrap style={{ width: '100%' }}>
            <Button icon={<FilterOutlined />} onClick={() => setMobileFilterOpen(true)}>
              筛选
            </Button>
            <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
              内容搜索
            </Button>
          </Space>
          <Space wrap style={{ width: '100%' }}>
            <NewDraftModal
              onFinish={(data) => {
                reloadCurrentList();
                history.push(`/editor?type=draft&id=${data.id}`);
              }}
            />
            <ImportDraftModal
              onFinish={() => {
                reloadCurrentList();
                message.success('导入成功！');
              }}
            />
          </Space>
        </Space>
      </Card>

      <AdminMobileCardList
        items={mobileRows}
        loading={mobileLoading}
        rowKey="id"
        emptyText="暂无草稿"
        pagination={{
          current: mobilePage,
          pageSize: normalizeDraftPageSize(pageSize, defaultPageSize),
          total: mobileTotal,
          pageSizeOptions: DRAFT_PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            const normalizedPageSize = normalizeDraftPageSize(nextPageSize, defaultPageSize);
            if (normalizedPageSize !== pageSize) {
              setPageSize(normalizedPageSize);
            }
            setMobilePage(nextPage);
          },
        }}
        renderCard={(record) => (
          <Card className="admin-mobile-record-card">
            <div className="admin-mobile-record-title-row">
              <div className="admin-mobile-record-title">{record.title || `草稿 ${record.id}`}</div>
              <Tag color="purple">{record.category || '未分类'}</Tag>
            </div>
            <div className="admin-mobile-record-meta">
              <span>ID {record.id}</span>
              <span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            {record.tags?.length ? (
              <div className="admin-mobile-record-tags">
                {record.tags.map((item) => (
                  <Tag key={`${record.id}-${item}`}>{item}</Tag>
                ))}
              </div>
            ) : null}
            <div className="admin-mobile-record-actions">
              <Button
                type="primary"
                onClick={() => history.push(`/editor?type=draft&id=${record.id}`)}
              >
                编辑
              </Button>
              <PublishDraftModal
                title={record.title}
                id={record.id}
                onFinish={() => {
                  reloadCurrentList();
                }}
                trigger={<Button>发布</Button>}
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'to-document',
                      label: '转为文档',
                      onClick: () => handleConvertToDocument(record),
                    },
                    {
                      key: 'export',
                      label: '导出 Markdown',
                      onClick: () => exportDraftMarkdown(record),
                    },
                    {
                      key: 'delete',
                      label: '删除草稿',
                      danger: true,
                      onClick: () => handleDeleteOne(record),
                    },
                  ],
                }}
              >
                <Button icon={<MoreOutlined />}>更多</Button>
              </Dropdown>
            </div>
          </Card>
        )}
      />

      <Drawer
        title="筛选草稿"
        placement="bottom"
        height={320}
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input
            allowClear
            placeholder="标题关键词"
            value={mobileFilterDraft.title}
            onChange={(event) =>
              setMobileFilterDraft((state) => ({
                ...state,
                title: event.target.value,
              }))
            }
          />
          <Select
            allowClear
            placeholder="选择分类"
            value={mobileFilterDraft.category}
            options={categories.map((item) => ({
              label: item,
              value: item,
            }))}
            onChange={(value) =>
              setMobileFilterDraft((state) => ({
                ...state,
                category: value,
              }))
            }
          />
          <Select
            allowClear
            showSearch
            placeholder="选择标签"
            value={mobileFilterDraft.tags}
            options={tags.map((item) => ({
              label: item,
              value: item,
            }))}
            onChange={(value) =>
              setMobileFilterDraft((state) => ({
                ...state,
                tags: value,
              }))
            }
          />
          <Space wrap style={{ width: '100%' }}>
            <Button type="primary" onClick={handleApplyMobileFilters}>
              应用筛选
            </Button>
            <Button onClick={handleResetMobileFilters}>重置</Button>
          </Space>
        </Space>
      </Drawer>
    </>
  );

  return (
    <PageContainer
      title={null}
      extra={null}
      ghost
      header={{ title: null, extra: null, ghost: true }}
      className="t-8"
    >
      {mobile ? (
        renderMobileContent()
      ) : (
        <RcResizeObserver
          key="resize-observer"
          onResize={(offset) => {
            setSimpleSearch(offset.width < 750);
            const narrowTable = offset.width < 800;
            setSimplePage(offset.width < 600);
            setColKeys(narrowTable ? draftKeysObjSmall : draftKeysObj);
          }}
        >
          <ProTable
            columns={columns}
            actionRef={actionRef}
            cardBordered
            rowSelection={{
              fixed: true,
              preserveSelectedRowKeys: true,
            }}
            tableAlertOptionRender={({ selectedRowKeys, onCleanSelected }) => {
              return (
                <Space>
                  <a
                    onClick={async () => {
                      await batchDelete(selectedRowKeys, true);
                      message.success('批量删除成功！');
                      actionRef.current.reload();
                      onCleanSelected();
                    }}
                  >
                    批量删除
                  </a>
                  <a
                    onClick={() => {
                      batchExport(selectedRowKeys, true);
                      onCleanSelected();
                    }}
                  >
                    批量导出
                  </a>
                  <a onClick={onCleanSelected}>取消选择</a>
                </Space>
              );
            }}
            request={async (params = {}, sort) => {
              const { current, pageSize: currentPageSize, ...searchObj } = params;
              const option = buildDraftListOption({
                current,
                pageSize: currentPageSize,
                filters: searchObj,
                sort,
                defaultPageSize,
              });
              const { data } = await getDraftsByOption(option);
              const { drafts, total } = data;

              return {
                data: drafts,
                success: Boolean(data),
                total,
              };
            }}
            editable={false}
            columnsState={{
              value: colKeys,
              onChange(value) {
                setColKeys(value);
              },
            }}
            rowKey="id"
            search={{
              labelWidth: 'auto',
              className: 'searchCard',
              span: searchSpan,
            }}
            pagination={{
              pageSize: normalizeDraftPageSize(pageSize, defaultPageSize),
              showSizeChanger: true,
              pageSizeOptions: DRAFT_PAGE_SIZE_OPTIONS,
              onChange: (_, nextPageSize) => {
                const normalizedPageSize = normalizeDraftPageSize(nextPageSize, defaultPageSize);
                if (normalizedPageSize !== pageSize) {
                  setPageSize(normalizedPageSize);
                }
              },
              simple: simplePage,
            }}
            dateFormatter="string"
            headerTitle={simpleSearch ? undefined : '草稿管理'}
            options={simpleSearch ? false : true}
            toolBarRender={() => [
              <Tooltip title="搜索草稿内容" key="searchContent">
                <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
                  内容搜索
                </Button>
              </Tooltip>,
              <NewDraftModal
                key="newDraft123"
                onFinish={(data) => {
                  actionRef?.current?.reload();
                  history.push(`/editor?type=draft&id=${data.id}`);
                }}
              />,
              <ImportDraftModal
                key="importDraftMarkdown"
                onFinish={() => {
                  actionRef?.current?.reload();
                  message.success('导入成功！');
                }}
              />,
            ]}
          />
        </RcResizeObserver>
      )}

      <ConvertToDocumentModal
        visible={showConvertToDocumentModal}
        draft={convertingDraft}
        onCancel={() => {
          setShowConvertToDocumentModal(false);
          setConvertingDraft(null);
        }}
        onOk={() => {
          handleConvertToDocumentSuccess();
          if (mobile) {
            fetchMobileDrafts();
          }
        }}
      />

      <ContentSearchModal
        visible={showContentSearch}
        onCancel={() => setShowContentSearch(false)}
        type="draft"
        onSelect={handleSearchSelect}
      />
    </PageContainer>
  );
};
