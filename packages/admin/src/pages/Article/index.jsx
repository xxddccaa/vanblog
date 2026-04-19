import AdminMobileCardList from '@/components/AdminMobileCardList';
import ContentSearchModal from '@/components/ContentSearchModal';
import ImportArticleModal from '@/components/ImportArticleModal';
import NewArticleModal from '@/components/NewArticleModal';
import {
  deleteArticle,
  getAllCategories,
  getArticleById,
  getArticlesByOption,
  getSiteInfo,
  getTags,
} from '@/services/van-blog/api';
import { batchDelete, batchExport } from '@/services/van-blog/batch';
import { getPathname } from '@/services/van-blog/getPathname';
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
import { articleObjAll, articleObjSmall, columns } from './columns';

const MAX_ARTICLE_PAGE_SIZE = 100;
const DEFAULT_ARTICLE_PAGE_SIZE = 20;
const ARTICLE_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
const ARTICLE_PAGE_SIZE_STORAGE_KEY = 'van-blog-admin-num-article-page-size';

const normalizeArticlePageSize = (value, fallback = DEFAULT_ARTICLE_PAGE_SIZE) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 10), MAX_ARTICLE_PAGE_SIZE);
};

const buildArticleListOption = ({
  current,
  pageSize,
  filters = {},
  sort = {},
  defaultPageSize,
}) => {
  const option = {};

  if (sort.createdAt) {
    option.sortCreatedAt = sort.createdAt === 'ascend' ? 'asc' : 'desc';
  }
  if (sort.top) {
    option.sortTop = sort.top === 'ascend' ? 'asc' : 'desc';
  }
  if (sort.viewer) {
    option.sortViewer = sort.viewer === 'ascend' ? 'asc' : 'desc';
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
  option.pageSize = normalizeArticlePageSize(pageSize, defaultPageSize);
  return option;
};

const exportArticleMarkdown = async (record) => {
  const { data: obj } = await getArticleById(record.id);
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
  const [colKeys, setColKeys] = useState(articleObjAll);
  const [simplePage, setSimplePage] = useState(false);
  const [simpleSearch, setSimpleSearch] = useState(false);
  const [defaultPageSize, setDefaultPageSize] = useState(DEFAULT_ARTICLE_PAGE_SIZE);
  const [pageSize, setPageSize] = useNum(defaultPageSize, 'article-page-size');
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

  const handleSearchSelect = (article) => {
    history.push(`/editor?type=article&id=${article.id}`);
  };

  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const { data } = await getSiteInfo();
        const configuredPageSize = normalizeArticlePageSize(
          data?.adminArticlePageSize,
          DEFAULT_ARTICLE_PAGE_SIZE,
        );
        setDefaultPageSize(configuredPageSize);
        const storedPageSize = localStorage.getItem(ARTICLE_PAGE_SIZE_STORAGE_KEY);
        if (!storedPageSize) {
          setPageSize(configuredPageSize);
          return;
        }
        const normalizedStoredPageSize = normalizeArticlePageSize(
          storedPageSize,
          configuredPageSize,
        );
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

  const fetchMobileArticles = useCallback(async () => {
    if (!mobile) {
      return;
    }

    setMobileLoading(true);
    try {
      const option = buildArticleListOption({
        current: mobilePage,
        pageSize,
        filters: mobileFilters,
        defaultPageSize,
      });
      const { data } = await getArticlesByOption(option);
      setMobileRows(data?.articles || []);
      setMobileTotal(data?.total || 0);
    } catch (error) {
      message.error('加载文章列表失败');
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
    fetchMobileArticles();
  }, [fetchMobileArticles]);

  const reloadCurrentList = useCallback(() => {
    if (mobile) {
      fetchMobileArticles();
      return;
    }

    actionRef.current?.reload();
  }, [fetchMobileArticles, mobile]);

  const handleDeleteOne = useCallback(
    (record) => {
      Modal.confirm({
        title: `确定删除 "${record.title}" 吗？`,
        onOk: async () => {
          if (location.hostname === 'blog-demo.mereith.com' && [28, 29].includes(record.id)) {
            message.warn('演示站禁止删除此文章！');
            return false;
          }
          await deleteArticle(record.id);
          message.success('删除成功!');
          reloadCurrentList();
          return true;
        },
      });
    },
    [reloadCurrentList],
  );

  const handleViewArticle = useCallback((record) => {
    const targetPath = `/post/${getPathname(record)}`;
    if (!record?.hidden) {
      window.open(targetPath, '_blank', 'noopener,noreferrer');
      return;
    }

    Modal.confirm({
      title: '此文章为隐藏文章！',
      content: (
        <div>
          <p>隐藏文章在未开启通过 URL 访问的情况下（默认关闭），会出现 404 页面。</p>
          <p>您可以在布局配置中修改此项。</p>
        </div>
      ),
      onOk: () => {
        window.open(targetPath, '_blank', 'noopener,noreferrer');
        return true;
      },
      okText: '仍然访问',
      cancelText: '返回',
    });
  }, []);

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
            <div className="admin-mobile-toolbar-title">文章管理</div>
            <div className="admin-mobile-toolbar-subtitle">
              手机上优先展示搜索、筛选和核心编辑动作。
            </div>
          </div>
          <Input.Search
            allowClear
            enterButton="搜索标题"
            placeholder="输入文章标题"
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
            <Button onClick={() => history.push(`/editor?type=about&id=${0}`)}>编辑关于</Button>
          </Space>
          <Space wrap style={{ width: '100%' }}>
            <NewArticleModal
              onFinish={(data) => {
                reloadCurrentList();
                history.push(`/editor?type=article&id=${data.id}`);
              }}
            />
            <ImportArticleModal
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
        emptyText="暂无文章"
        pagination={{
          current: mobilePage,
          pageSize: normalizeArticlePageSize(pageSize, defaultPageSize),
          total: mobileTotal,
          pageSizeOptions: ARTICLE_PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            const normalizedPageSize = normalizeArticlePageSize(nextPageSize, defaultPageSize);
            if (normalizedPageSize !== pageSize) {
              setPageSize(normalizedPageSize);
            }
            setMobilePage(nextPage);
          },
        }}
        renderCard={(record) => (
          <Card className="admin-mobile-record-card">
            <div className="admin-mobile-record-title-row">
              <div className="admin-mobile-record-title">{record.title || `文章 ${record.id}`}</div>
              <Tag color="blue">{record.category || '未分类'}</Tag>
            </div>
            <div className="admin-mobile-record-meta">
              <span>ID {record.id}</span>
              <span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <Space wrap>
              {record.top ? <Tag color="gold">置顶 {record.top}</Tag> : null}
              <Tag color="cyan">浏览 {record.viewer || 0}</Tag>
              {record.hidden ? <Tag color="volcano">隐藏</Tag> : null}
            </Space>
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
                onClick={() => history.push(`/editor?type=article&id=${record.id}`)}
              >
                编辑
              </Button>
              <Button onClick={() => handleViewArticle(record)}>查看</Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'export',
                      label: '导出 Markdown',
                      onClick: () => exportArticleMarkdown(record),
                    },
                    {
                      key: 'delete',
                      label: '删除文章',
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
        title="筛选文章"
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
      className="t-8"
      header={{ title: null, extra: null, ghost: true }}
    >
      {mobile ? (
        renderMobileContent()
      ) : (
        <RcResizeObserver
          key="resize-observer"
          onResize={(offset) => {
            const narrowTable = offset.width < 1000;

            setSimpleSearch(offset.width < 750);
            setSimplePage(offset.width < 600);
            setColKeys(narrowTable ? articleObjSmall : articleObjAll);
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
                      await batchDelete(selectedRowKeys);
                      message.success('批量删除成功！');
                      actionRef.current.reload();
                      onCleanSelected();
                    }}
                  >
                    批量删除
                  </a>
                  <a
                    onClick={() => {
                      batchExport(selectedRowKeys);
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
              const option = buildArticleListOption({
                current,
                pageSize: currentPageSize,
                filters: searchObj,
                sort,
                defaultPageSize,
              });
              const { data } = await getArticlesByOption(option);
              const { articles, total } = data;
              return {
                data: articles,
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
              span: searchSpan,
              className: 'searchCard',
            }}
            pagination={{
              pageSize: normalizeArticlePageSize(pageSize, defaultPageSize),
              simple: simplePage,
              showSizeChanger: true,
              pageSizeOptions: ARTICLE_PAGE_SIZE_OPTIONS,
              onChange: (_, nextPageSize) => {
                const normalizedPageSize = normalizeArticlePageSize(nextPageSize, defaultPageSize);
                if (normalizedPageSize !== pageSize) {
                  setPageSize(normalizedPageSize);
                }
              },
            }}
            dateFormatter="string"
            headerTitle={simpleSearch ? undefined : '文章管理'}
            options={simpleSearch ? false : true}
            toolBarRender={() => [
              <Tooltip title="搜索文章内容" key="searchContent">
                <Button icon={<SearchOutlined />} onClick={() => setShowContentSearch(true)}>
                  内容搜索
                </Button>
              </Tooltip>,
              <Button
                key="editAboutMe"
                onClick={() => {
                  history.push(`/editor?type=about&id=${0}`);
                }}
              >
                编辑关于
              </Button>,
              <NewArticleModal
                key="newArticle123"
                onFinish={(data) => {
                  actionRef?.current?.reload();
                  history.push(`/editor?type=article&id=${data.id}`);
                }}
              />,
              <ImportArticleModal
                key="importArticleBtn"
                onFinish={() => {
                  actionRef?.current?.reload();
                  message.success('导入成功！');
                }}
              />,
            ]}
          />
        </RcResizeObserver>
      )}

      <ContentSearchModal
        visible={showContentSearch}
        onCancel={() => setShowContentSearch(false)}
        type="article"
        onSelect={handleSearchSelect}
      />
    </PageContainer>
  );
};
