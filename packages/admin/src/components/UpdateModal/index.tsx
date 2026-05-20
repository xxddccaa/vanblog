import {
  createCategory,
  getAllCategories,
  getTags,
  updateArticle,
  updateDraft,
  updateDocument,
} from '@/services/van-blog/api';
import { ModalForm, ProFormDateTimePicker, ProFormSelect, ProFormText } from '@ant-design/pro-form';
import { Form, message, Modal } from 'antd';
import moment from 'moment';
import { useEffect } from 'react';
import AuthorField from '../AuthorField';
const normalizeCategories = (value: any) => {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(new Set(source.map((item) => String(item || '').trim()).filter(Boolean)));
};

const loadCategoryOptions = async () => {
  const { data: categories } = await getAllCategories();
  return (categories || []).map((e: string) => ({
    label: e,
    value: e,
  }));
};

const ensureCategoriesExist = async (categories: string[]) => {
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

export default function (props: {
  currObj: any;
  setLoading: any;
  onFinish: any;
  type: 'article' | 'draft' | 'about' | 'document';
}) {
  const { currObj, setLoading, type, onFinish } = props;
  const [form] = Form.useForm();
  const ensureSuccess = (result: any, fallbackMessage: string) => {
    if (result?.statusCode !== 200) {
      throw new Error(result?.message || fallbackMessage);
    }
    return result?.data;
  };
  const buildSubmitValues = (values: any) => {
    if (type === 'document') {
      return {
        title: values?.title,
      };
    }
    if (type === 'article') {
      const categories = normalizeCategories(values?.categories || values?.category);
      return {
        ...values,
        categories,
        category: categories[0],
      };
    }
    return values;
  };
  useEffect(() => {
    if (form && form.setFieldsValue) {
      form.setFieldsValue({
        ...currObj,
        categories:
          type === 'article'
            ? normalizeCategories(currObj?.categories || currObj?.category)
            : currObj?.categories,
      });
    }
  }, [currObj, form, type]);
  return (
    <ModalForm
      form={form}
      title="修改信息"
      trigger={
        <a key="button" type="link">
          修改信息
        </a>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      initialValues={currObj || {}}
      onFinish={async (values) => {
        const submitValues = buildSubmitValues(values);
        if (location.hostname == 'blog-demo.mereith.com' && type != 'draft') {
          Modal.info({
            title: '演示站禁止修改信息！',
            content: '本来是可以的，但有个人在演示站首页放黄色信息，所以关了这个权限了。',
          });
          return;
        }
        if (!currObj || !currObj.id) {
          return false;
        }
        setLoading(true);
        try {
          if (type == 'article') {
            await ensureCategoriesExist(submitValues.categories || []);
            ensureSuccess(await updateArticle(currObj?.id, submitValues), '修改文章失败！');
            onFinish();
            message.success('修改文章成功！');
          } else if (type == 'draft') {
            ensureSuccess(await updateDraft(currObj?.id, values), '修改草稿失败！');
            onFinish();
            message.success('修改草稿成功！');
          } else if (type == 'document') {
            ensureSuccess(await updateDocument(currObj?.id, submitValues), '修改文档失败！');
            onFinish();
            message.success('修改文档成功！');
          } else {
            return false;
          }
          return true;
        } catch (error: any) {
          message.error(error?.message || '修改失败！');
          return false;
        } finally {
          setLoading(false);
        }
      }}
      layout="horizontal"
      labelCol={{ span: 6 }}
      key="editForm"
      // wrapperCol: { span: 14 },
    >
      <ProFormText
        width="md"
        required
        id="title"
        name="title"
        label={type === 'document' ? '文档标题' : '文章标题'}
        placeholder={type === 'document' ? '请输入文档标题' : '请输入标题'}
        rules={[{ required: true, message: '这是必填项' }]}
      />
      {type !== 'document' && <AuthorField />}
      {type !== 'document' && (
        <ProFormSelect
          width="md"
          name="tags"
          label="标签"
          placeholder="请选择或输入标签"
          fieldProps={{
            mode: 'tags',
            tokenSeparators: [','],
          }}
          request={async () => {
            const msg = await getTags();
            return msg?.data?.map((item) => ({ label: item, value: item })) || [];
          }}
        />
      )}
      {type === 'article' && (
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
      )}
      {type === 'draft' && (
        <ProFormSelect
          width="md"
          required
          id="category"
          name="category"
          label="分类"
          placeholder="请选择分类"
          rules={[{ required: true, message: '这是必填项' }]}
          request={loadCategoryOptions}
        />
      )}
      {type !== 'document' && (
        <ProFormDateTimePicker
          width="md"
          name="createdAt"
          id="createdAt"
          label="创建时间"
          placeholder="不填默认为此刻"
          fieldProps={{
            showTime: true,
          }}
        />
      )}
      {type == 'article' && (
        <>
          <ProFormText
            width="md"
            id="top"
            name="top"
            label="置顶优先级"
            placeholder="留空或0表示不置顶，其余数字越大表示优先级越高"
          />
          <ProFormText
            width="md"
            id="pathname"
            name="pathname"
            label="自定义路径名"
            tooltip="文章发布后的路径将为 /post/[自定义路径名]，如果未设置则使用文章 id 作为路径名"
            placeholder="留空或为空则使用 id 作为路径名"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) {
                    return Promise.resolve();
                  }
                  // 检查是否为纯数字
                  if (/^\d+$/.test(value.trim())) {
                    return Promise.reject(new Error('自定义路径名不能为纯数字，避免与文章ID冲突'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
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
          <ProFormText
            width="md"
            id="copyright"
            name="copyright"
            label="版权声明"
            tooltip="设置后会替换掉文章页底部默认的版权声明文字，留空则根据系统设置中的相关选项进行展示"
            placeholder="设置后会替换掉文章底部默认的版权"
          />
        </>
      )}
    </ModalForm>
  );
}
