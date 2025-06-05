import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
  updateCategoriesSort,
  initializeCategoriesSort,
} from '@/services/van-blog/api';
import { encodeQuerystring } from '@/services/van-blog/encode';
import { PlusOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { ModalForm, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import { Button, message, Modal } from 'antd';
import { useRef, useState } from 'react';

export default function () {
  const [dataSource, setDataSource] = useState([]);
  const actionRef = useRef();

  const fetchData = async () => {
    const { data: res } = await getAllCategories(true);
    const sortedData = res.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const mappedData = sortedData.map((item, index) => ({
      key: item.name,
      ...item,
      sort: item.sort !== undefined ? item.sort : index,
    }));
    setDataSource(mappedData);
    return mappedData;
  };

  const moveCategory = async (index, direction) => {
    const newDataSource = [...dataSource];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newDataSource.length) {
      return;
    }

    // 交换位置
    [newDataSource[index], newDataSource[targetIndex]] = [newDataSource[targetIndex], newDataSource[index]];
    
    // 更新排序字段
    const updatedCategories = newDataSource.map((item, idx) => ({
      name: item.name,
      sort: idx,
    }));

    try {
      // 更新本地状态
      const updatedDataSource = newDataSource.map((item, idx) => ({
        ...item,
        sort: idx,
      }));
      setDataSource(updatedDataSource);

      // 调用API更新排序
      await updateCategoriesSort(updatedCategories);
      message.success('分类排序更新成功！');
    } catch (error) {
      message.error('排序更新失败，请重试');
      // 恢复原始排序
      actionRef?.current?.reload();
    }
  };

  const columns = [
    {
      dataIndex: 'sort',
      title: '排序',
      width: 120,
      search: false,
      render: (_, record, index) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ minWidth: '20px' }}>{record.sort}</span>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => moveCategory(index, 'up')}
            title="上移"
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === dataSource.length - 1}
            onClick={() => moveCategory(index, 'down')}
            title="下移"
          />
        </div>
      ),
    },
    {
      dataIndex: 'name',
      title: '题目',
      search: false,
    },
    {
      title: '加密',
      tooltip:
        '分类加密后，此分类下的所有文章都会被加密。密码以分类的密码为准。加密后，访客仍可正常访问分类并获取文章列表。',
      dataIndex: 'private',
      search: false,
      valueType: 'select',
      valueEnum: {
        [true]: {
          text: '加密',
          status: 'Error',
        },
        [false]: {
          text: '未加密',
          status: 'Success',
        },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      render: (text, record, _, action) => [
        <a
          key="viewCategory"
          onClick={() => {
            window.open(`/category/${encodeQuerystring(record.name)}`, '_blank');
          }}
        >
          查看
        </a>,
        <ModalForm
          key={`editCateoryC%{${record.name}}`}
          title={`修改分类 "${record.name}"`}
          trigger={<a key={'editC' + record.name}>修改</a>}
          autoFocusFirstInput
          initialValues={{
            password: record.password,
            private: record.private,
          }}
          submitTimeout={3000}
          onFinish={async (values) => {
            if (Object.keys(values).length == 0) {
              message.error('无有效信息！请至少填写一个选项！');
              return false;
            }
            if (values.private && !values.password) {
              message.error('如若加密，请填写密码！');
              return false;
            }

            Modal.confirm({
              content: `确定修改分类 "${record.name}" 吗？改动将立即生效!`,
              onOk: async () => {
                await updateCategory(record.name, values);
                message.success('提交成功');
                action?.reload();
                return true;
              },
            });

            return true;
          }}
        >
          <ProFormText
            width="md"
            name="name"
            label="分类名"
            placeholder="请输入新的分类名称"
            rules={[
              { 
                validator: (_, value) => {
                  if (value !== undefined && value !== null && value.trim().length === 0) {
                    return Promise.reject(new Error('分类名称不能为空或只包含空格'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          />
          <ProFormSelect
            width="md"
            name="private"
            label="是否加密"
            placeholder="是否加密"
            request={async () => {
              return [
                { label: '未加密', value: false },
                { label: '加密', value: true },
              ];
            }}
          />
          <ProFormText.Password
            width="md"
            name="password"
            label="密码"
            placeholder="请输入加密密码"
          />
        </ModalForm>,

        <a
          key={'deleteCategoryC' + record.name}
          onClick={() => {
            Modal.confirm({
              title: `确定删除分类 "${record.name}"吗？`,
              onOk: async () => {
                try {
                  await deleteCategory(record.name);
                  message.success('删除成功!');
                } catch {}
                action?.reload();
              },
            });
            // action?.startEditable?.(record.id);
          }}
        >
          删除
        </a>,
      ],
    },
  ];

  return (
    <>
      <ProTable
        rowKey="name"
        columns={columns}
        search={false}
        dateFormatter="string"
        actionRef={actionRef}
        options={false}
        dataSource={dataSource}
        toolBarRender={() => [
          <Button
            key="initSort"
            onClick={async () => {
              Modal.confirm({
                title: '确定要初始化分类排序吗？',
                content: '这将为所有分类设置默认排序，按创建时间顺序排列。',
                onOk: async () => {
                  try {
                    await initializeCategoriesSort();
                    message.success('初始化成功！');
                    actionRef?.current?.reload();
                  } catch (error) {
                    message.error('初始化失败，请重试');
                  }
                },
              });
            }}
          >
            初始化排序
          </Button>,
          <ModalForm
            title="新建分类"
            key="newCategoryN"
            trigger={
              <Button key="buttonCN" icon={<PlusOutlined />} type="primary">
                新建分类
              </Button>
            }
            width={450}
            autoFocusFirstInput
            submitTimeout={3000}
            onFinish={async (values) => {
              await createCategory(values);
              actionRef?.current?.reload();
              message.success('新建分类成功！');
              return true;
            }}
            layout="horizontal"
            labelCol={{ span: 6 }}
          >
            <ProFormText
              width="md"
              required
              id="nameC"
              name="name"
              label="分类名称"
              key="nameCCCC"
              placeholder="请输入分类名称"
              rules={[
                { required: true, message: '这是必填项' },
                { 
                  validator: (_, value) => {
                    if (!value || value.trim().length === 0) {
                      return Promise.reject(new Error('分类名称不能为空或只包含空格'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            />
          </ModalForm>,
        ]}
        request={async () => {
          const data = await fetchData();
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        headerTitle={
          <div style={{ color: '#666', fontSize: '14px' }}>
            提示：使用上下箭头按钮可调整分类显示顺序
          </div>
        }
      />
    </>
  );
}
