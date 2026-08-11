import axios from 'axios';
import { isIP } from 'node:net';

export function normalizeClientIp(input: unknown): string | null {
  let value = String(input || '').trim();
  if (!value) return null;

  const bracketed = value.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketed) value = bracketed[1];
  const zoneIndex = value.indexOf('%');
  if (zoneIndex >= 0) value = value.slice(0, zoneIndex);

  const ipv4WithPort = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) value = ipv4WithPort[1];

  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];
  return isIP(value) ? value.toLowerCase() : null;
}

function ipv4IsPrivate(ip: string) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function isPrivateClientIp(ip: string) {
  const normalized = normalizeClientIp(ip);
  if (!normalized) return false;
  if (isIP(normalized) === 4) return ipv4IsPrivate(normalized);

  const compact = normalized.toLowerCase();
  return (
    compact === '::' ||
    compact === '::1' ||
    compact.startsWith('fc') ||
    compact.startsWith('fd') ||
    /^fe[89ab]/.test(compact)
  );
}

export function getRequestIp(req: any): string | null {
  const trustProxy = Boolean(req?.app?.get?.('trust proxy'));
  const candidates = [
    ...(trustProxy ? [req?.ip, ...(req?.ips || [])] : []),
    req?.socket?.remoteAddress,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeClientIp(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export async function getNetIp(req: any) {
  const ip = getRequestIp(req);
  if (!ip) {
    return { address: '获取失败', ip: '', isPrivate: false, valid: false };
  }
  const isPrivate = isPrivateClientIp(ip);
  if (isPrivate) {
    return { address: '私有网络', ip, isPrivate: true, valid: true };
  }

  try {
    const { data } = await axios.get(`https://cip.cc/${encodeURIComponent(ip)}`, {
      timeout: 1500,
      maxContentLength: 64 * 1024,
      maxRedirects: 0,
    });
    const ipRegx = /.*IP\t:(.*)\n/;
    const addrRegx = /.*数据二\t:(.*)\n/;
    if (data && ipRegx.test(data) && addrRegx.test(data)) {
      const address = String(data.match(addrRegx)[1] || '').trim();
      return { address, ip, isPrivate: false, valid: true };
    }
  } catch {
    // Geolocation is best-effort and never participates in access decisions.
  }
  return { address: '获取失败', ip, isPrivate: false, valid: true };
}

export function getPlatform(userAgent: string): 'mobile' | 'desktop' {
  const ua = userAgent.toLowerCase();
  const testUa = (regexp: RegExp) => regexp.test(ua);
  const testVs = (regexp: RegExp) =>
    (ua.match(regexp) || [])
      .toString()
      .replace(/[^0-9|_.]/g, '')
      .replace(/_/g, '.');

  // 系统
  let system = 'unknow';
  if (testUa(/windows|win32|win64|wow32|wow64/g)) {
    system = 'windows'; // windows系统
  } else if (testUa(/macintosh|macintel/g)) {
    system = 'macos'; // macos系统
  } else if (testUa(/x11/g)) {
    system = 'linux'; // linux系统
  } else if (testUa(/android|adr/g)) {
    system = 'android'; // android系统
  } else if (testUa(/ios|iphone|ipad|ipod|iwatch/g)) {
    system = 'ios'; // ios系统
  }

  let platform = 'desktop';
  if (system === 'windows' || system === 'macos' || system === 'linux') {
    platform = 'desktop';
  } else if (system === 'android' || system === 'ios' || testUa(/mobile/g)) {
    platform = 'mobile';
  }

  return platform as 'mobile' | 'desktop';
}
