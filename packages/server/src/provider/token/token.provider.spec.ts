import { TokenProvider } from './token.provider';

describe('TokenProvider', () => {
  it('stores only a SHA-256 digest for newly issued API tokens and limits them to 90 days', async () => {
    const createdRecord = {
      toObject: jest.fn(function () {
        return this;
      }),
    } as any;
    const tokenModel = {
      create: jest.fn(async (payload) => Object.assign(createdRecord, payload)),
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('header.payload.signature'),
    };
    const structuredDataService = {
      upsertToken: jest.fn(),
    };
    const provider = new TokenProvider(
      tokenModel as any,
      jwtService as any,
      {} as any,
      structuredDataService as any,
    );

    await expect(provider.createAPIToken('deploy')).resolves.toBe(
      'header.payload.signature',
    );
    expect(tokenModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresIn: 60 * 60 * 24 * 90,
        token: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      }),
    );
    expect(tokenModel.create.mock.calls[0][0].token).not.toContain(
      'header.payload.signature',
    );
  });

  it('keeps token import synchronized with PG incrementally instead of rebuilding all structured tokens', async () => {
    const tokenModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      upsertToken: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new TokenProvider(
      tokenModel as any,
      {} as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.importTokens([{ token: 'abc', userId: 1, disabled: false }]);

    expect(tokenModel.updateOne).toHaveBeenCalledWith(
      { token: 'abc' },
      { token: 'abc', userId: 1, disabled: false },
      { upsert: true },
    );
    expect(structuredDataService.upsertToken).toHaveBeenCalledWith({
      token: 'abc',
      userId: 1,
      disabled: false,
    });
  });

  it('rejects tokens that exist in storage but fail JWT verification', async () => {
    const provider = new TokenProvider(
      {
        findOne: jest.fn(),
      } as any,
      {
        verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')),
      } as any,
      {} as any,
      {
        getTokenByToken: jest.fn().mockResolvedValue({
          token: 'abc',
          disabled: false,
        }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    await expect(provider.checkToken('abc')).resolves.toBe(false);
  });

  it('accepts only admin-like payloads for admin token checks', async () => {
    const provider = new TokenProvider(
      {
        findOne: jest.fn(),
      } as any,
      {
        verifyAsync: jest
          .fn()
          .mockResolvedValueOnce({ sub: 0, type: 'admin' })
          .mockResolvedValueOnce({ sub: 2, type: 'collaborator' }),
      } as any,
      {} as any,
      {
        getTokenByToken: jest
          .fn()
          .mockResolvedValueOnce({ token: 'admin-token', disabled: false })
          .mockResolvedValueOnce({ token: 'collab-token', disabled: false }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    await expect(provider.checkAdminToken('admin-token')).resolves.toBe(true);
    await expect(provider.checkAdminToken('collab-token')).resolves.toBe(false);
  });

  it('rejects API tokens for super-admin session checks used by public preview flows', async () => {
    const provider = new TokenProvider(
      {
        findOne: jest.fn(),
      } as any,
      {
        verifyAsync: jest
          .fn()
          .mockResolvedValueOnce({ sub: 0, role: 'admin' })
          .mockResolvedValueOnce({ sub: 0, type: 'admin' }),
      } as any,
      {} as any,
      {
        getTokenByToken: jest
          .fn()
          .mockResolvedValueOnce({ token: 'api-token', userId: 666666, disabled: false })
          .mockResolvedValueOnce({ token: 'session-token', userId: 0, disabled: false })
          .mockResolvedValueOnce({ token: 'session-token', userId: 0, disabled: false }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    await expect(provider.checkSuperAdminSessionToken('api-token')).resolves.toBe(false);
    await expect(provider.checkSuperAdminSessionToken('session-token')).resolves.toBe(true);
  });
});
