import { getSharedSecret } from './sharedSecret';

describe('getSharedSecret', () => {
  it('prefers VANBLOG_SHARED_SECRET over the legacy name', () => {
    expect(
      getSharedSecret({
        VANBLOG_SHARED_SECRET: 'new-shared-secret',
        WALINE_JWT_TOKEN: 'legacy-shared-secret',
      }),
    ).toBe('new-shared-secret');
  });

  it('falls back to the legacy WALINE_JWT_TOKEN', () => {
    expect(getSharedSecret({ WALINE_JWT_TOKEN: 'legacy-shared-secret' })).toBe(
      'legacy-shared-secret',
    );
    expect(
      getSharedSecret({ VANBLOG_SHARED_SECRET: '', WALINE_JWT_TOKEN: 'legacy-shared-secret' }),
    ).toBe('legacy-shared-secret');
  });

  it('returns an empty string when neither name is set', () => {
    expect(getSharedSecret({})).toBe('');
  });
});
