import { createArticle, createCategory, getAllCategories, getTags } from '@/services/van-blog/api';
import { parseMarkdownFile } from '@/services/van-blog/parseMarkdownFile';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Button, Form, Upload } from 'antd';
import moment from 'moment';
import { useState } from 'react';
const normalizeCategories = (value) => {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(source.map((item) => String(item || '').trim()).filter(Boolean)));
};

const loadCategoryOptions = async () => {
  const { data: categories } = await getAllCategories();
  return (categories || []).map((e) => ({
    label: e,
    value: e,
  }));
};

const ensureCategoriesExist = async (categories) => {
  const { data: existingCategories } = await getAllCategories();
  const existing = new Set(existingCategories || []);
  const missing = categories.filter((category) => !existing.has(category));
  for (const category of missing) {
    const result = await createCategory({ name: category });
    if (result?.statusCode && result.statusCode !== 200) {
      throw new Error(result?.message || `创建分类 / 专栏 "${category}" 失败`);
    }
  }
};

export default function (props) {
  const { onFinish } = props;
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const handleUpload = async (file) => {
    const vals = await parseMarkdownFile(file);
    if (vals) {
      vals.categories = normalizeCategories(vals.categories || vals.category);
      vals.category = vals.categories[0];
      await ensureCategoriesExist(vals.categories);
      await createArticle(vals);
    }
  };
  const beforeUpload = async (file, files) => {
    if (files.length > 1) {
      await handleUpload(file);
      if (files[files.length - 1] == file) {
        if (onFinish) {
          onFinish();
        }
      }
    } else {
      const vals = await parseMarkdownFile(file);
      form.setFieldsValue(vals);
      setVisible(true);
    }
  };
  return (
    <>
      <Upload showUploadList={false} multiple={true} accept={'.md'} beforeUpload={beforeUpload}>
        <Button key="button" type="primary" title="从 markdown 文件导入，可多选">
          导入
        </Button>
      </Upload>
      <ModalForm
        form={form}
        title="导入文章"
        visible={visible}
        onVisibleChange={(v) => {
          setVisible(v);
        }}
        width={450}
        autoFocusFirstInput
        submitTimeout={3000}
        onFinish={async (values) => {
          const washedValues = {};
          for (const [k, v] of Object.entries(values)) {
            washedValues[k.replace('C', '')] = v;
          }
          washedValues.categories = normalizeCategories(washedValues.categories || washedValues.category);
          washedValues.category = washedValues.categories[0];
          await ensureCategoriesExist(washedValues.categories);

          await createArticle(washedValues);
          if (onFinish) {
            onFinish();
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
          id="title"
          name="title"
          label="文章标题"
          placeholder="请输入标题"
          rules={[{ required: true, message: '这是必填项' }]}
        />
        <ProFormText
          width="md"
          id="top"
          name="top"
          label="置顶优先级"
          placeholder="留空或0表示不置顶，其余数字越大表示优先级越高"
        />
        <ProFormSelect
          mode="tags"
          tokenSeparators={[',']}
          width="md"
          name="tags"
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
          id="categories"
          name="categories"
          label="分类 / 专栏"
          placeholder="搜索或输入分类/专栏"
          rules={[{ required: true, message: '这是必填项' }]}
          fieldProps={{
            mode: 'tags',
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
          showTime={{
            defaultValue: moment('00:00:00', 'HH:mm:ss'),
          }}
          width="md"
          name="createdAt"
          id="createdAt"
          label="创建时间"
        />
        <ProFormSelect
          width="md"
          name="private"
          id="private"
          label="是否加密"
          placeholder="是否加密"
          request={async () => {
            return [
              {
                label: '否',
                value: false,
              },
              {
                label: '是',
                value: true,
              },
            ];
          }}
        />
        <ProFormText.Password
          label="密码"
          width="md"
          id="password"
          name="password"
          autocomplete="new-password"
          placeholder="请输入密码"
          dependencies={['private']}
        />
        <ProFormSelect
          width="md"
          name="hidden"
          id="hidden"
          label="是否隐藏"
          placeholder="是否隐藏"
          request={async () => {
            return [
              {
                label: '否',
                value: false,
              },
              {
                label: '是',
                value: true,
              },
            ];
          }}
        />
        <ProFormTextArea
          name="content"
          label="内容"
          id="content"
          fieldProps={{ autoSize: { minRows: 3, maxRows: 5 } }}
        />
      </ModalForm>
    </>
  );
}
