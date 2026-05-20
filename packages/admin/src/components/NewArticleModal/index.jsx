import { createArticle, createCategory, getAllCategories, getTags } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button, Modal, message } from 'antd';
import moment from 'moment';
import AuthorField from '../AuthorField';

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
  return (
    <ModalForm
      title="新建文章"
      trigger={
        <Button key="button" type="primary">
          新建文章
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        if (location.hostname == 'blog-demo.mereith.com') {
          Modal.info({
            title: '演示站禁止新建文章！',
            content: '本来是可以的，但有个人在演示站首页放黄色信息，所以关了这个权限了。',
          });
          return;
        }
        const washedValues = {};
        for (const [k, v] of Object.entries(values)) {
          washedValues[k.replace('C', '')] = v;
        }

        washedValues.categories = normalizeCategories(washedValues.categories);
        washedValues.category = washedValues.categories[0];
        try {
          await ensureCategoriesExist(washedValues.categories);
        } catch (error) {
          message.error(error?.message || '创建分类 / 专栏失败');
          return false;
        }

        const { data } = await createArticle(washedValues);
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
      <ProFormText
        width="md"
        id="topC"
        name="topC"
        label="置顶优先级"
        placeholder="留空或0表示不置顶，其余数字越大表示优先级越高"
      />
      <ProFormText
        width="md"
        id="pathnameC"
        name="pathnameC"
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
        id="categoriesC"
        name="categoriesC"
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
        placeholder="不填默认为此刻"
        name="createdAtC"
        id="createdAtC"
        label="创建时间"
        width="md"
        showTime={{
          defaultValue: moment('00:00:00', 'HH:mm:ss'),
        }}
      />

      <ProFormSelect
        width="md"
        name="privateC"
        id="privateC"
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
        id="passwordC"
        name="passwordC"
        autocomplete="new-password"
        placeholder="请输入密码"
        dependencies={['private']}
      />
      <ProFormSelect
        width="md"
        name="hiddenC"
        id="hiddenC"
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
        id="copyrightC"
        name="copyrightC"
        label="版权声明"
        tooltip="设置后会替换掉文章页底部默认的版权声明文字，留空则根据系统设置中的相关选项进行展示"
        placeholder="设置后会替换掉文章底部默认的版权"
      />
    </ModalForm>
  );
}
