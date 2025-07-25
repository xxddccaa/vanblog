import { checkDemo } from './check';
import { parseObjToMarkdown } from './parseMarkdownFile';
import { getArticleById, deleteArticle, deleteDraft, getDraftById, deleteMoment } from './api';
import { Modal } from 'antd';

// 批量操作
export const batchDelete = (ids: string[], isDraft = false) => {
  return new Promise((resolve, reject) => {
    const result = checkDemo();
    if (!result) {
      reject();
      return;
    }
    Modal.confirm({
      title: '确定要删除选中内容吗？',
      content: '删除后无法恢复',
      onOk: async () => {
        let cnt = 0;
        for (const id of ids) {
          const fn = isDraft ? deleteDraft : deleteArticle;

          fn(id).finally(() => {
            cnt = cnt + 1;
            if (cnt >= ids.length) {
              resolve(true);
              return;
            }
          });
        }
      },
    });
  });
};

// 批量删除动态
export const batchDeleteMoments = (ids: string[]) => {
  return new Promise((resolve, reject) => {
    const result = checkDemo();
    if (!result) {
      reject();
      return;
    }
    Modal.confirm({
      title: '确定要删除选中的动态吗？',
      content: '删除后无法恢复',
      onOk: async () => {
        let cnt = 0;
        for (const id of ids) {
          deleteMoment(id).finally(() => {
            cnt = cnt + 1;
            if (cnt >= ids.length) {
              resolve(true);
              return;
            }
          });
        }
      },
    });
  });
};

// 批量删除导航工具
export const batchDeleteNavTools = (ids: string[]) => {
  return new Promise((resolve, reject) => {
    const result = checkDemo();
    if (!result) {
      reject();
      return;
    }
    Modal.confirm({
      title: '确定要删除选中的工具吗？',
      content: '删除后无法恢复',
      onOk: async () => {
        let cnt = 0;
        for (const id of ids) {
          fetch(`/api/admin/nav-tool/${id}`, {
            method: 'DELETE',
            headers: {
              'token': localStorage.getItem('token') || '',
            },
          }).finally(() => {
            cnt = cnt + 1;
            if (cnt >= ids.length) {
              resolve(true);
              return;
            }
          });
        }
      },
    });
  });
};

// 批量删除导航分类
export const batchDeleteNavCategories = (ids: string[]) => {
  return new Promise((resolve, reject) => {
    const result = checkDemo();
    if (!result) {
      reject();
      return;
    }
    Modal.confirm({
      title: '确定要删除选中的分类吗？',
      content: '删除前请确保这些分类下没有工具',
      onOk: async () => {
        let cnt = 0;
        for (const id of ids) {
          fetch(`/api/admin/nav-category/${id}`, {
            method: 'DELETE',
            headers: {
              'token': localStorage.getItem('token') || '',
            },
          }).finally(() => {
            cnt = cnt + 1;
            if (cnt >= ids.length) {
              resolve(true);
              return;
            }
          });
        }
      },
    });
  });
};

export const batchExport = async (ids: string[], isDraft = false) => {
  for (const id of ids) {
    await exportEachById(id, isDraft);
  }
};

export const exportEachById = async (id: string, isDraft = false) => {
  const fn = isDraft ? getDraftById : getArticleById;
  const { data: obj } = await getArticleById(id);
  const md = parseObjToMarkdown(obj);
  const data = new Blob([md]);
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${obj.title}.md`;
  link.click();
};
