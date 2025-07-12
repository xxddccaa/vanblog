import ImportArticleModal from '@/components/ImportArticleModal';
import NewArticleModal from '@/components/NewArticleModal';
import ContentSearchModal from '@/components/ContentSearchModal';
import { getArticlesByOption, getSiteInfo } from '@/services/van-blog/api';
import { batchExport, batchDelete } from '@/services/van-blog/batch';
import { useNum } from '@/services/van-blog/useNum';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Space, message, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import RcResizeObserver from 'rc-resize-observer';
import { useMemo, useRef, useState, useEffect } from 'react';
import { history } from 'umi';
import { articleObjAll, articleObjSmall, columns } from './columns';

export default () => {
  const actionRef = useRef();
  const [colKeys, setColKeys] = useState(articleObjAll);
  const [simplePage, setSimplePage] = useState(false);
  const [simpleSearch, setSimpleSearch] = useState(false);
  const [defaultPageSize, setDefaultPageSize] = useState(20);
  const [pageSize, setPageSize] = useNum(defaultPageSize, 'article-page-size');
  const [showContentSearch, setShowContentSearch] = useState(false);

  // 处理搜索结果选择
  const handleSearchSelect = (article) => {
    history.push(`/editor?type=article&id=${article.id}`);
  };

  // 获取站点配置中的默认分页大小
  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const { data } = await getSiteInfo();
        const configuredPageSize = data?.adminArticlePageSize || 20;
        setDefaultPageSize(configuredPageSize);
        // 如果本地存储中没有自定义值，使用配置的默认值
        const localStorageKey = 'article-page-size';
        const storedPageSize = localStorage.getItem(localStorageKey);
        if (!storedPageSize) {
          setPageSize(configuredPageSize);
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
    } else {
      return 24;
    }
  }, [simpleSearch]);
  return (
    <PageContainer
      title={null}
      extra={null}
      ghost
      className="t-8"
      header={{ title: null, extra: null, ghost: true }}
    >
      <RcResizeObserver
        key="resize-observer"
        onResize={(offset) => {
          const r = offset.width < 1000;

          setSimpleSearch(offset.width < 750);
          setSimplePage(offset.width < 600);
          if (r) {
            setColKeys(articleObjSmall);
          } else {
            setColKeys(articleObjAll);
          }
          //  小屏幕的话把默认的 col keys 删掉一些
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
          request={async (params = {}, sort, filter) => {
            const option = {};
            if (sort.createdAt) {
              if (sort.createdAt == 'ascend') {
                option.sortCreatedAt = 'asc';
              } else {
                option.sortCreatedAt = 'desc';
              }
            }
            if (sort.top) {
              if (sort.top == 'ascend') {
                option.sortTop = 'asc';
              } else {
                option.sortTop = 'desc';
              }
            }
            if (sort.viewer) {
              if (sort.viewer == 'ascend') {
                option.sortViewer = 'asc';
              } else {
                option.sortViewer = 'desc';
              }
            }

            // 搜索
            const { current, pageSize, ...searchObj } = params;
            if (searchObj) {
              for (const [targetName, target] of Object.entries(searchObj)) {
                switch (targetName) {
                  case 'title':
                    if (target.trim() != '') {
                      option.title = target;
                    }
                    break;
                  case 'tags':
                    if (target.trim() != '') {
                      option.tags = target;
                    }
                    break;
                  case 'endTime':
                    if (searchObj?.startTime) {
                      option.startTime = searchObj?.startTime;
                    }
                    if (searchObj?.endTime) {
                      option.endTime = searchObj?.endTime;
                    }
                    break;
                  case 'category':
                    if (target.trim() != '') {
                      option.category = target;
                    }
                    break;
                }
              }
            }
            option.page = current;
            option.pageSize = pageSize;
            const { data } = await getArticlesByOption(option);
            const { articles, total } = data;
            return {
              data: articles,
              // success 请返回 true，
              // 不然 table 会停止解析数据，即使有数据
              success: Boolean(data),
              // 不传会使用 data 的长度，如果是分页一定要传
              total: total,
            };
          }}
          editable={false}
          columnsState={{
            // persistenceKey: 'van-blog-article-table',
            // persistenceType: 'localStorage',
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
            pageSize: pageSize,
            simple: simplePage,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100', '200', '500', '1000'],
            onChange: (p, ps) => {
              if (ps != pageSize) {
                setPageSize(ps);
              }
            },
          }}
          dateFormatter="string"
          headerTitle={simpleSearch ? undefined : '文章管理'}
          options={simpleSearch ? false : true}
          toolBarRender={() => [
            <Tooltip title="搜索文章内容" key="searchContent">
              <Button
                icon={<SearchOutlined />}
                onClick={() => setShowContentSearch(true)}
              >
                内容搜索
              </Button>
            </Tooltip>,
            <Button
              key="editAboutMe"
              onClick={() => {
                history.push(`/editor?type=about&id=${0}`);
              }}
            >
              {`编辑关于`}
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
      
      {/* 内容搜索模态框 */}
      <ContentSearchModal
        visible={showContentSearch}
        onCancel={() => setShowContentSearch(false)}
        type="article"
        onSelect={handleSearchSelect}
      />
    </PageContainer>
  );
};
