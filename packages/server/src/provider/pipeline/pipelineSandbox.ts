export const PIPELINE_SANDBOX_PRELOAD = `
  'use strict';
  const Module = require('node:module');
  const blocked = new Set([
    'child_process', 'cluster', 'dgram', 'dns', 'http', 'http2', 'https',
    'module', 'net', 'tls', 'worker_threads'
  ]);
  const blockedBindings = new Set([
    'cares_wrap', 'http_parser', 'pipe_wrap', 'stream_wrap', 'tcp_wrap', 'udp_wrap'
  ]);
  const normalize = (request) => String(request || '').replace(/^node:/, '');
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (blocked.has(normalize(request))) {
      throw new Error('流水线沙箱禁止加载模块: ' + request);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  if (typeof process.getBuiltinModule === 'function') {
    const originalGetBuiltinModule = process.getBuiltinModule.bind(process);
    process.getBuiltinModule = (request) => {
      if (blocked.has(normalize(request))) {
        throw new Error('流水线沙箱禁止加载模块: ' + request);
      }
      return originalGetBuiltinModule(request);
    };
  }
  if (typeof process.binding === 'function') {
    const originalBinding = process.binding.bind(process);
    process.binding = (request) => {
      if (blockedBindings.has(normalize(request))) {
        throw new Error('流水线沙箱禁止访问原生绑定: ' + request);
      }
      return originalBinding(request);
    };
  }
  globalThis.fetch = undefined;
  globalThis.WebSocket = undefined;
  globalThis.EventSource = undefined;
`;
