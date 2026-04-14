import axios from 'axios';

function normalizeIp(ip: string) {
  const normalized = String(ip || '').trim();
  if (!normalized) {
    return '';
  }
  return normalized.includes(':') ? normalized.slice(normalized.lastIndexOf(':') + 1) : normalized;
}

function isPrivateIp(ip: string) {
  if (!ip) {
    return true;
  }
  if (ip === '::1' || ip === '1') {
    return true;
  }
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return true;
  }
  const segments = ip.split('.');
  if (segments.length === 4 && segments[0] === '172') {
    const second = Number(segments[1]);
    if (!Number.isNaN(second) && second >= 16 && second <= 31) {
      return true;
    }
  }
  return false;
}

export async function getNetIp(req: any) {
  const trustProxy = Boolean(req?.app?.get?.('trust proxy'));
  const ipArray = [
    ...new Set(
      [
        trustProxy ? req.ip : undefined,
        ...(trustProxy ? req.ips || [] : []),
        req?.socket?.remoteAddress,
      ]
        .filter(Boolean)
        .map((item) => String(item).trim()),
    ),
  ];
  let ip = ipArray[0];

  if (ipArray.length > 1) {
    for (let i = 0; i < ipArray.length; i++) {
      const candidate = normalizeIp(ipArray[i]);
      if (isPrivateIp(candidate)) {
        continue;
      }
      ip = candidate;
      break;
    }
  }
  ip = normalizeIp(ip);
  if (isPrivateIp(ip)) {
    ip = '';
  }
  if (!ip) {
    return { address: `获取失败`, ip: '' };
  }
  try {
    const { data } = await axios.get(`https://cip.cc/${ip}`);
    // const ipApi = got.got
    //   .get(`https://whois.pconline.com.cn/ipJson.jsp?ip=${ip}&json=true`)
    //   .buffer();

    const ipRegx = /.*IP	:(.*)\n/;
    const addrRegx = /.*数据二	:(.*)\n/;
    if (data && ipRegx.test(data) && addrRegx.test(data)) {
      const ip = String(data.match(ipRegx)[1] || '').trim();
      const addr = String(data.match(addrRegx)[1] || '').trim();
      return { address: addr, ip };
    } else {
      return { address: `获取失败`, ip };
    }
  } catch (error) {
    return { address: `获取失败`, ip };
  }
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
