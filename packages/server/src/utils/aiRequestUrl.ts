import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';
import { lookup } from 'node:dns';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

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
  const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  return (
    normalized === '::1' ||
    normalized === '::' ||
    (mapped ? isPrivateIpv4(mapped[1]) : false) ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  );
}

export function isPublicOutboundIp(address: string) {
  const type = isIP(address);
  if (type === 4) return !isPrivateIpv4(address);
  if (type === 6) return !isPrivateIpv6(address);
  return false;
}

function createValidatedLookup(expectedHostname: string) {
  return (hostname: string, _options: any, callback: any) => {
    if (hostname.toLowerCase() !== expectedHostname.toLowerCase()) {
      callback(new Error('outbound hostname changed unexpectedly'));
      return;
    }
    lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        callback(error);
        return;
      }
      if (!addresses.length || addresses.some(({ address }) => !isPublicOutboundIp(address))) {
        callback(new Error('outbound hostname resolves to a non-public address'));
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

export function getSafeOutboundAxiosConfig(url: string) {
  const parsed = new URL(url);
  const safeLookup = createValidatedLookup(parsed.hostname);
  return {
    timeout: 10_000,
    maxRedirects: 0,
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 1024 * 1024,
    httpAgent: new HttpAgent({ lookup: safeLookup }),
    httpsAgent: new HttpsAgent({ lookup: safeLookup }),
  };
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
