import ColumnsToolBar from '@/components/ColumnsToolBar';
import PublishDraftModal from '@/components/PublishDraftModal';
import UpdateModal from '@/components/UpdateModal';
import { genActiveObj } from '@/services/van-blog/activeColTools';
import { deleteDraft, getAllCategories, getDraftById, getTags } from '@/services/van-blog/api';
import { parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { message, Modal, Tag } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { history } from 'umi';

export const getColumns = (handleConvertToDocument) => [
  {
    dataIndex: 'id',
    valueType: 'number',
    title: 'ID',
    width: 40,
    search: false,
  },
  {
    title: '标题',
    dataIndex: 'title',
    copyable: true,
    ellipsis: false,
    width: 500,
    tip: '标题完整显示',
    render: (text) => (
      <div
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 10,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          wordBreak: 'break-word',
          lineHeight: '1.5'
        }}
      >
        {text}
      </div>
    ),
    formItemProps: {
      rules: [
        {
          required: true,
          message: '此项为必填项',
        },
      ],
    },
  },
  {
    title: '分类',
    dataIndex: 'category',
    width: 100,
    valueType: 'select',
    request: async () => {
      const { data: categories } = await getAllCategories();
      const data = categories?.map((each) => ({
        label: each,
        value: each,
      }));

      return data;
    },
  },
  {
    title: '标签',
    dataIndex: 'tags',
    search: true,
    fieldProps: { showSearch: true, placeholder: '请搜索或选择' },
    valueType: 'select',
    width: 160,
    renderFormItem: (_, { defaultRender }) => {
      return defaultRender(_);
    },
    request: async () => {
      const { data: tags } = await getTags();
      const data = tags.map((each) => ({
        label: each,
        value: each,
      }));
      return data;
    },
    render: (val, record) => {
      if (!record?.tags?.length) {
        return '-';
      } else {
        return (
          <div
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 10,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              lineHeight: '1.5'
            }}
          >
            {record?.tags?.map((each) => (
              <Tag style={{ marginBottom: 4 }} key={`tag-${each}`}>
                {each}
              </Tag>
            ))}
          </div>
        );
      }
    },
  },
  {
    title: '创建时间',
    key: 'showTime',
    dataIndex: 'createdAt',
    valueType: 'dateTime',
    sorter: true,
    hideInSearch: true,
    width: 180,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    valueType: 'dateRange',
    hideInTable: true,
    search: {
      transform: (value) => {
        return {
          startTime: value[0],
          endTime: value[1],
        };
      },
    },
  },
  {
    title: '操作',
    valueType: 'option',
    key: 'option',
    width: 140,
    render: (text, record, _, action) => {
      return (
        <ColumnsToolBar
          outs={[
            <a
              key={'editable' + record.id}
              onClick={() => {
                history.push(`/editor?type=draft&id=${record.id}`);
              }}
            >
              编辑
            </a>,
            ,
            <PublishDraftModal
              key="publishRecord1213"
              title={record.title}
              id={record.id}
              action={action}
              trigger={<a key="publishRecord123">发布</a>}
            />,
          ]}
          nodes={[
            <UpdateModal
              key={'updateDraft' + record.id}
              currObj={record}
              setLoading={() => {}}
              type="draft"
              onFinish={() => {
                action?.reload();
              }}
            />,
            <a
              key={'convertToDocument' + record.id}
              onClick={() => {
                handleConvertToDocument(record);
              }}
            >
              <SwapOutlined /> 转为文档
            </a>,
            <a
              key={'exportDraft' + record.id}
              onClick={async () => {
                const { data: obj } = await getDraftById(record.id);
                const md = parseObjToMarkdown(obj);
                const data = new Blob([md]);
                const url = URL.createObjectURL(data);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${record.title}.md`;
                link.click();
              }}
            >
              导出
            </a>,
            <a
              key={'deleteDraft' + record.id}
              onClick={() => {
                Modal.confirm({
                  title: `确定删除草稿 "${record.title}" 吗？`,
                  onOk: async () => {
                    await deleteDraft(record.id);
                    message.success('删除成功!');
                    action?.reload();
                  },
                });
              }}
            >
              删除
            </a>,
          ]}
        ></ColumnsToolBar>
      );
    },
  },
];

// 为了保持向后兼容，导出默认的columns
export const columns = getColumns(() => {
  console.warn('handleConvertToDocument function not provided');
});

export const draftKeys = ['category', 'id', 'option', 'showTime', 'tags', 'title'];
export const draftKeysSmall = ['category', 'id', 'option', 'title'];

export const draftKeysObj = genActiveObj(draftKeys, draftKeys);
export const draftKeysObjSmall = genActiveObj(draftKeysSmall, draftKeys);
