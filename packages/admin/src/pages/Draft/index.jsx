import ImportDraftModal from '@/components/ImportDraftModal';
import NewDraftModal from '@/components/NewDraftModal';
import ConvertToDocumentModal from '@/components/ConvertToDocumentModal';
import ContentSearchModal from '@/components/ContentSearchModal';
import { getDraftsByOption, getSiteInfo } from '@/services/van-blog/api';
import { useNum } from '@/services/van-blog/useNum';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import RcResizeObserver from 'rc-resize-observer';
import { useMemo, useRef, useState, useEffect } from 'react';
import { history } from 'umi';
import { getColumns, draftKeysObj, draftKeysObjSmall } from './columes';
import { Button, Space, message, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { batchExport, batchDelete } from '@/services/van-blog/batch';

export default () => {
  const actionRef = useRef();
  const [colKeys, setColKeys] = useState(draftKeysObj);
  const [simplePage, setSimplePage] = useState(false);
  const [simpleSearch, setSimpleSearch] = useState(false);
  const [defaultPageSize, setDefaultPageSize] = useState(20);
  const [pageSize, setPageSize] = useNum(defaultPageSize, 'draft-page-size');
  const [showConvertToDocumentModal, setShowConvertToDocumentModal] = useState(false);
  const [convertingDraft, setConvertingDraft] = useState(null);
  const [showContentSearch, setShowContentSearch] = useState(false);

  // 处理搜索结果选择
  const handleSearchSelect = (draft) => {
    history.push(`/editor?type=draft&id=${draft.id}`);
  };

  // 处理转换为文档
  const handleConvertToDocument = (draft) => {
    setConvertingDraft(draft);
    setShowConvertToDocumentModal(true);
  };

  // 处理转换成功
  const handleConvertToDocumentSuccess = () => {
    setShowConvertToDocumentModal(false);
    setConvertingDraft(null);
    actionRef.current?.reload();
  };

  // 获取站点配置中的默认分页大小
  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const { data } = await getSiteInfo();
        const configuredPageSize = data?.adminDraftPageSize || 20;
        setDefaultPageSize(configuredPageSize);
        // 如果本地存储中没有自定义值，使用配置的默认值
        const localStorageKey = 'draft-page-size';
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

  const columns = useMemo(() => {
    return getColumns(handleConvertToDocument);
  }, [handleConvertToDocument]);
  return (
    <PageContainer
      title={null}
      extra={null}
      ghost
      header={{ title: null, extra: null, ghost: true }}
      className="t-8"
    >
      <RcResizeObserver
        key="resize-observer"
        onResize={(offset) => {
          setSimpleSearch(offset.width < 750);
          const r = offset.width < 800;
          setSimplePage(offset.width < 600);
          if (r) {
            setColKeys(draftKeysObjSmall);
          } else {
            setColKeys(draftKeysObj);
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
            const { data } = await getDraftsByOption(option);
            const { drafts, total } = data;

            return {
              data: drafts,
              // success 请返回 true，
              // 不然 table 会停止解析数据，即使有数据
              success: Boolean(data),
              // 不传会使用 data 的长度，如果是分页一定要传
              total: total,
            };
          }}
          editable={false}
          columnsState={{
            // persistenceKey: 'van-blog-draft-table',
            // persistenceType: 'localStorage',
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
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100', '200', '500', '1000'],
            onChange: (p, ps) => {
              if (ps != pageSize) {
                setPageSize(ps);
              }
            },
            simple: simplePage,
          }}
          dateFormatter="string"
          headerTitle={simpleSearch ? undefined : '草稿管理'}
          options={simpleSearch ? false : true}
          toolBarRender={() => [
            <Tooltip title="搜索草稿内容" key="searchContent">
              <Button
                icon={<SearchOutlined />}
                onClick={() => setShowContentSearch(true)}
              >
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
      
      {/* 转换为文档模态框 */}
      <ConvertToDocumentModal
        visible={showConvertToDocumentModal}
        draft={convertingDraft}
        onCancel={() => {
          setShowConvertToDocumentModal(false);
          setConvertingDraft(null);
        }}
        onOk={handleConvertToDocumentSuccess}
      />
      
      {/* 内容搜索模态框 */}
      <ContentSearchModal
        visible={showContentSearch}
        onCancel={() => setShowContentSearch(false)}
        type="draft"
        onSelect={handleSearchSelect}
      />
    </PageContainer>
  );
};
