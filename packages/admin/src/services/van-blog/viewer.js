import { request } from 'umi';

export async function getViewerData() {
  return request('/api/admin/meta/viewer', {
    method: 'GET',
  });
}

export async function updateSiteViewer(data) {
  return request('/api/admin/meta/viewer/site', {
    method: 'PUT',
    data,
  });
}

export async function updateArticleViewer(data) {
  return request('/api/admin/meta/viewer/article', {
    method: 'PUT',
    data,
  });
}

export async function batchUpdateViewer(data) {
  return request('/api/admin/meta/viewer/batch', {
    method: 'PUT',
    data,
  });
}

export async function autoBoostViewer(data) {
  return request('/api/admin/meta/viewer/auto-boost', {
    method: 'PUT',
    data,
  });
} 