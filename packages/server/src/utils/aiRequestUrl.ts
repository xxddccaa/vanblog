import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

function isPrivateIpv4(hostname: string) {
  if (hostname === '0.0.0.0') {
    return true;
  }

  const segments = hostname.split('.').map((item) => Number(item));
  if (segments.length !== 4 || segments.some((item) => Number.isNaN(item))) {
    return false;
  }

  if (segments[0] === 10 || segments[0] === 127) {
    return true;
  }
  if (segments[0] === 192 && segments[1] === 168) {
    return true;
  }
  if (segments[0] === 169 && segments[1] === 254) {
    return true;
  }
  if (segments[0] === 172 && segments[1] >= 16 && segments[1] <= 31) {
    return true;
  }

  return false;
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

export function normalizeSafeOutboundHttpUrl(input: string, label = '请求地址') {
  const raw = String(input || '').trim();
  if (!raw) {
    throw new BadRequestException(`${label}不能为空`);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException(`${label}不合法`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException(`${label}仅支持 http 或 https`);
  }
  if (parsed.username || parsed.password) {
    throw new BadRequestException(`${label}不允许内嵌账号或密码`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new BadRequestException(`${label}缺少主机名`);
  }
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new BadRequestException(`${label}不允许使用本地回环地址`);
  }

  const ipType = isIP(hostname);
  if ((ipType === 4 && isPrivateIpv4(hostname)) || (ipType === 6 && isPrivateIpv6(hostname))) {
    throw new BadRequestException(`${label}不允许指向私网或回环地址`);
  }

  return parsed.toString().replace(/\/+$/, '');
}

export function normalizeAiRequestBaseUrl(input: string) {
  return normalizeSafeOutboundHttpUrl(input, 'AI 接口地址');
}
