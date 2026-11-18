import IP2Region from 'ip2region';
import {
  CLIENT_INFO_FIELD_MAX_LENGTH,
  CommentClientInfoProvider,
  RegionSearcher,
  cleanClientInfoField,
} from './client-info.provider';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

class StubbedClientInfoProvider extends CommentClientInfoProvider {
  created = 0;
  constructor(private readonly stub: () => RegionSearcher) {
    super();
  }
  protected createSearcher(): RegionSearcher {
    this.created += 1;
    return this.stub();
  }
}

describe('CommentClientInfoProvider', () => {
  describe('with the bundled ip2region database', () => {
    const provider = new CommentClientInfoProvider();

    const raw = new IP2Region();

    it('resolves a public IPv4 address to its province', () => {
      const expected = raw.search('120.24.78.68');
      expect(expected.province).not.toBe('');
      expect(expected.province).not.toBe(expected.country);
      expect(provider.resolveLocation('120.24.78.68')).toBe(expected.province);
    });

    it('falls back to the country when the database has no province', () => {
      const expected = raw.search('1.1.1.1');
      expect(expected.province).toBe('');
      expect(expected.country).not.toBe('');
      expect(provider.resolveLocation('1.1.1.1')).toBe(expected.country);
    });

    it('resolves a public IPv6 address', () => {
      const ip = '240e:47d:c20:1627:30a3:ba0d:a5e6:ec19';
      expect(raw.search(ip).province).not.toBe('');
      expect(provider.resolveLocation(ip)).toBe(raw.search(ip).province);
    });

    it('unwraps IPv4-mapped IPv6 addresses', () => {
      expect(provider.resolveLocation('::ffff:120.24.78.68')).toBe(
        provider.resolveLocation('120.24.78.68'),
      );
    });

    it.each(['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.9', '::1', 'fd00::1', 'fe80::1'])(
      'returns an empty location for the private or loopback address %s',
      (ip) => {
        expect(provider.resolveLocation(ip)).toBe('');
      },
    );

    it.each(['', 'not-an-ip', '999.1.1.1', '1.2.3', ':::', null, undefined, 42, {}])(
      'returns an empty location for the invalid input %p',
      (ip) => {
        expect(provider.resolveLocation(ip as any)).toBe('');
      },
    );

    it('returns an empty location when the database knows nothing about an address', () => {
      // Documentation range: ip2region has no country or province for it.
      expect(provider.resolveLocation('2001:db8::1')).toBe('');
    });
  });

  describe('location formatting', () => {
    it('prefers the province and falls back to the country', () => {
      const provider = new StubbedClientInfoProvider(() => ({
        search: (ip) =>
          ip === '1.1.1.1'
            ? { country: 'Country A', province: 'Province A' }
            : { country: 'Country B', province: '' },
      }));
      expect(provider.resolveLocation('1.1.1.1')).toBe('Province A');
      expect(provider.resolveLocation('8.8.8.8')).toBe('Country B');
    });

    it('cleans and truncates database values', () => {
      const provider = new StubbedClientInfoProvider(() => ({
        search: () => ({ country: '', province: ` Line\r\nBreak ${'x'.repeat(200)} ` }),
      }));
      const location = provider.resolveLocation('8.8.8.8');
      expect(location.startsWith('Line Break x')).toBe(true);
      expect(location).not.toMatch(/[\r\n]/u);
      expect(location.length).toBeLessThanOrEqual(CLIENT_INFO_FIELD_MAX_LENGTH);
    });

    it('loads the database lazily and only once', () => {
      const provider = new StubbedClientInfoProvider(() => ({ search: () => null }));
      expect(provider.created).toBe(0);
      provider.resolveLocation('127.0.0.1');
      expect(provider.created).toBe(0);
      provider.resolveLocation('8.8.8.8');
      provider.resolveLocation('8.8.4.4');
      expect(provider.created).toBe(1);
    });
  });

  describe('user agent parsing', () => {
    const provider = new StubbedClientInfoProvider(() => ({ search: () => null }));

    it('formats browser as name plus major version and os as name plus version', () => {
      expect(provider.parseUserAgent(CHROME_WINDOWS)).toEqual({
        browser: 'Chrome 131',
        os: 'Windows 10',
      });
      expect(provider.parseUserAgent(SAFARI_IPHONE)).toEqual({
        browser: 'Mobile Safari 17',
        os: 'iOS 17.5',
      });
    });

    it('omits a missing version', () => {
      expect(provider.parseUserAgent(FIREFOX_LINUX)).toEqual({
        browser: 'Firefox 128',
        os: 'Linux',
      });
    });

    it.each(['', '   ', 'curl/8.0', null, undefined])(
      'returns empty strings for the unknown agent %p',
      (ua) => {
        expect(provider.parseUserAgent(ua as any)).toEqual({ browser: '', os: '' });
      },
    );

    it('caps every field length', () => {
      const ua = `Mozilla/5.0 (Windows NT 10.0) Chrome/${'9'.repeat(300)}.0 Safari/537.36`;
      const { browser, os } = provider.parseUserAgent(ua);
      expect(browser.length).toBeLessThanOrEqual(CLIENT_INFO_FIELD_MAX_LENGTH);
      expect(os.length).toBeLessThanOrEqual(CLIENT_INFO_FIELD_MAX_LENGTH);
    });
  });

  describe('inspect', () => {
    it('combines location, browser and os', () => {
      const provider = new StubbedClientInfoProvider(() => ({
        search: () => ({ country: 'Country', province: 'Province' }),
      }));
      expect(provider.inspect('8.8.8.8', CHROME_WINDOWS)).toEqual({
        location: 'Province',
        browser: 'Chrome 131',
        os: 'Windows 10',
      });
    });

    it('never throws when the database cannot be loaded', () => {
      const provider = new StubbedClientInfoProvider(() => {
        throw new Error('missing database');
      });
      expect(provider.inspect('8.8.8.8', CHROME_WINDOWS)).toEqual({
        location: '',
        browser: 'Chrome 131',
        os: 'Windows 10',
      });
      // A broken database is not retried on every request.
      provider.inspect('8.8.4.4', '');
      expect(provider.created).toBe(1);
    });

    it('never throws when a lookup fails', () => {
      const provider = new StubbedClientInfoProvider(() => ({
        search: () => {
          throw new Error('corrupt record');
        },
      }));
      expect(provider.inspect('8.8.8.8', FIREFOX_LINUX).location).toBe('');
    });

    it('never throws on hostile input types', () => {
      const provider = new CommentClientInfoProvider();
      expect(() => provider.inspect({} as any, Symbol('ua') as any)).not.toThrow();
      expect(provider.inspect(undefined as any, undefined as any)).toEqual({
        location: '',
        browser: '',
        os: '',
      });
    });
  });

  it('cleanClientInfoField strips control characters and collapses whitespace', () => {
    expect(cleanClientInfoField('  a\u0000b \t\n c  ')).toBe('a b c');
    expect(cleanClientInfoField(undefined)).toBe('');
  });
});
