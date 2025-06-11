import { request } from 'umi';

// 获取AI打标配置
export async function getAITaggingConfig() {
  return request('/api/admin/ai-tagging/config', {
    method: 'GET',
  });
}

// 更新AI打标配置
export async function updateAITaggingConfig(data) {
  return request('/api/admin/ai-tagging/config', {
    method: 'PUT',
    data,
  });
}

// 获取文章列表（用于打标）
export async function getArticlesForTagging() {
  return request('/api/admin/ai-tagging/articles', {
    method: 'GET',
  });
}

// 生成AI标签
export async function generateAITags(data) {
  return request('/api/admin/ai-tagging/generate', {
    method: 'POST',
    data,
  });
}

// 更新文章标签
export async function updateArticleTags(articleId, tags, skipISR = false) {
  return request(`/api/admin/ai-tagging/article/${articleId}/tags`, {
    method: 'PUT',
    data: { tags, skipISR },
  });
}

// 触发ISR渲染
export async function triggerISR() {
  return request('/api/admin/ai-tagging/trigger-isr', {
    method: 'POST',
  });
} 