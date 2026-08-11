import {
  getRequestIp,
  isPrivateClientIp,
  normalizeClientIp,
} from './utils';

describe('network IP utilities', () => {
  it('preserves public IPv6 addresses instead of truncating them to the final segment', () => {
    expect(normalizeClientIp('2001:db8::1')).toBe('2001:db8::1');
    expect(isPrivateClientIp('2001:db8::1')).toBe(false);
  });

  it('normalizes only valid mapped IPv4 and socket address forms', () => {
    expect(normalizeClientIp('::ffff:192.168.1.10')).toBe('192.168.1.10');
    expect(normalizeClientIp('203.0.113.8:4312')).toBe('203.0.113.8');
    expect(normalizeClientIp('[2001:db8::5]:443')).toBe('2001:db8::5');
    expect(normalizeClientIp('not-an-ip:123')).toBeNull();
  });

  it('recognizes private IPv4 and IPv6 without classifying public IPv6 as trusted', () => {
    expect(isPrivateClientIp('127.0.0.1')).toBe(true);
    expect(isPrivateClientIp('192.168.1.2')).toBe(true);
    expect(isPrivateClientIp('fd00::1')).toBe(true);
    expect(isPrivateClientIp('fe80::1')).toBe(true);
    expect(isPrivateClientIp('2606:4700:4700::1111')).toBe(false);
  });

  it('uses proxy-derived addresses only when Express trusts the proxy', () => {
    const untrusted = {
      app: { get: () => false },
      ip: '8.8.8.8',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const trusted = {
      ...untrusted,
      app: { get: () => ['loopback'] },
    };

    expect(getRequestIp(untrusted)).toBe('127.0.0.1');
    expect(getRequestIp(trusted)).toBe('8.8.8.8');
  });
});
