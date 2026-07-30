import { createCategory, createDraft, getAllCategories, getTags } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button, message } from 'antd';
import moment from 'moment';
import AuthorField from '../AuthorField';

const normalizeCategory = (value) => {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return source.map((item) => String(item || '').trim()).filter(Boolean)[0];
};

const loadCategoryOptions = async () => {
  const { data: categories } = await getAllCategories();
  return (categories || []).map((e) => ({
    label: e,
    value: e,
  }));
};

const ensureCategoryExists = async (category) => {
  if (!category) {
    return;
  }
  const { data: existingCategories } = await getAllCategories();
  const existing = new Set(existingCategories || []);
  if (existing.has(category)) {
    return;
  }
  const result = await createCategory({ name: category });
  if (result?.statusCode && result.statusCode !== 200) {
    throw new Error(result?.message || `创建分类 "${category}" 失败`);
  }
};

export default function (props) {
  const { onFinish } = props;
  return (
    <ModalForm
      title="新建草稿"
      trigger={
        <Button key="button" type="primary">
          新建草稿
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        const washedValues = {};
        for (const [k, v] of Object.entries(values)) {
          washedValues[k.replace('C', '')] = v;
        }

        washedValues.category = normalizeCategory(washedValues.category);
        try {
          await ensureCategoryExists(washedValues.category);
        } catch (error) {
          message.error(error?.message || '创建分类失败');
          return false;
        }

        const { data } = await createDraft(washedValues);
        if (onFinish) {
          onFinish(data);
        }
        return true;
      }}
      layout="horizontal"
      labelCol={{ span: 6 }}
      // wrapperCol: { span: 14 },
    >
      <ProFormText
        width="md"
        required
        id="titleC"
        name="titleC"
        label="文章标题"
        placeholder="请输入标题"
        rules={[{ required: true, message: '这是必填项' }]}
      />
      <AuthorField />
      <ProFormSelect
        mode="tags"
        tokenSeparators={[',']}
        width="md"
        name="tagsC"
        label="标签"
        placeholder="请选择或输入标签"
        request={async () => {
          const msg = await getTags();
          return msg?.data?.map((item) => ({ label: item, value: item })) || [];
        }}
      />
      <ProFormSelect
        width="md"
        required
        id="categoryC"
        name="categoryC"
        label="分类"
        tooltip="可搜索已有分类，或直接输入并回车创建新的分类"
        placeholder="搜索或输入分类"
        rules={[{ required: true, message: '这是必填项' }]}
        fieldProps={{
          mode: 'tags',
          maxCount: 1,
          showSearch: true,
          tokenSeparators: [','],
          filterOption: (input, option) =>
            String(option?.label || option?.value || '')
              .toLowerCase()
              .includes(input.toLowerCase()),
        }}
        request={loadCategoryOptions}
      />
      <ProFormDateTimePicker
        width="md"
        name="createdAtC"
        id="createdAtC"
        label="创建时间"
        placeholder="不填默认为此刻"
        showTime={{
          defaultValue: moment('00:00:00', 'HH:mm:ss'),
        }}
      />
    </ModalForm>
  );
}
