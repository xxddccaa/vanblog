import request from '@/services/request';

/**
 * @typedef {Object} AiTerminalStatus
 * @property {boolean} enabled
 * @property {string} entryPath
 * @property {string} workspacePath
 * @property {string} homePath
 * @property {string[]} tools
 */

export async function getAIQAConfig() {
  return request('/api/admin/ai-qa/config', {
    method: 'GET',
  });
}

export async function updateAIQAConfig(data) {
  return request('/api/admin/ai-qa/config', {
    method: 'PUT',
    data,
  });
}

export async function getAIQAStatus() {
  return request('/api/admin/ai-qa/status', {
    method: 'GET',
  });
}

export async function getAIQAConversations(params) {
  return request('/api/admin/ai-qa/conversations', {
    method: 'GET',
    params,
  });
}

export async function getAIQAConversationDetail(id) {
  return request(`/api/admin/ai-qa/conversations/${id}`, {
    method: 'GET',
  });
}

export async function renameAIQAConversation(id, data) {
  return request(`/api/admin/ai-qa/conversations/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteAIQAConversation(id) {
  return request(`/api/admin/ai-qa/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function testAIQAConnection(data = {}) {
  return request('/api/admin/ai-qa/test-connection', {
    method: 'POST',
    data,
  });
}

export async function syncAIQAFull(data = {}) {
  return request('/api/admin/ai-qa/sync/full', {
    method: 'POST',
    data,
  });
}

export async function syncBundledAIQAModels(data = {}) {
  return request('/api/admin/ai-qa/bundled-models/sync', {
    method: 'POST',
    data,
  });
}

export async function provisionAIQAResources(data = {}) {
  return request('/api/admin/ai-qa/provision', {
    method: 'POST',
    data,
  });
}

export async function migrateLegacyAIQAResources(data = {}) {
  return request('/api/admin/ai-qa/migrate-legacy', {
    method: 'POST',
    data,
  });
}

export async function testBundledAIQAModels(data = {}) {
  return request('/api/admin/ai-qa/bundled-models/test', {
    method: 'POST',
    data,
  });
}

export async function chatWithAIQA(data) {
  return request('/api/admin/ai-qa/chat', {
    method: 'POST',
    data,
  });
}

export async function getAIQATerminalStatus() {
  return request('/api/admin/ai-qa/terminal/status', {
    method: 'GET',
  });
}

export async function openAIQATerminalSession() {
  return request('/api/admin/ai-qa/terminal/session', {
    method: 'POST',
  });
}

export async function closeAIQATerminalSession() {
  return request('/api/admin/ai-qa/terminal/session', {
    method: 'DELETE',
  });
}
