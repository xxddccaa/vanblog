import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AiQaTerminalProvider } from './ai-qa-terminal.provider';

describe('AiQaTerminalProvider', () => {
  const originalJwtSecret = global.jwtSecret;
  const originalTerminalEnabled = process.env['VANBLOG_AI_TERMINAL_ENABLED'];

  beforeEach(() => {
    global.jwtSecret = 'test-jwt-secret';
    delete process.env['VANBLOG_AI_TERMINAL_ENABLED'];
  });

  afterEach(() => {
    if (originalTerminalEnabled === undefined) {
      delete process.env['VANBLOG_AI_TERMINAL_ENABLED'];
    } else {
      process.env['VANBLOG_AI_TERMINAL_ENABLED'] = originalTerminalEnabled;
    }
    global.jwtSecret = originalJwtSecret;
  });

  const createProvider = (overrides: Record<string, any> = {}) => {
    const jwtService = new JwtService({
      secret: global.jwtSecret,
      signOptions: {
        expiresIn: 3600,
      },
    });
    const userProvider = {
      getUser: jest.fn().mockResolvedValue({ id: 0, name: 'admin', type: 'admin' }),
      getCollaboratorById: jest
        .fn()
        .mockResolvedValue({ id: 7, type: 'collaborator', permissions: ['all'] }),
      ...overrides.userProvider,
    };

    return {
      provider: new AiQaTerminalProvider(jwtService, userProvider as any),
      userProvider,
    };
  };

  it('returns disabled status when the terminal overlay is off', () => {
    const { provider } = createProvider();

    expect(provider.getStatus()).toEqual({
      enabled: false,
      entryPath: '/admin/ai-terminal',
      workspacePath: '/workspace/vanblog',
      homePath: '/app/ai-terminal-home',
      tools: ['opencode', 'python3', 'pip', 'git', 'rg', 'tmux', 'bash'],
    });
  });

  it('returns enabled status when the terminal overlay env is on', () => {
    process.env['VANBLOG_AI_TERMINAL_ENABLED'] = 'true';
    const { provider } = createProvider();

    expect(provider.getStatus().enabled).toBe(true);
  });

  it('rejects opening a session when the terminal overlay is disabled', async () => {
    const { provider } = createProvider();

    await expect(
      provider.openSession({ id: 0 }, { headers: {} } as any, { cookie: jest.fn() } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('authorizes a valid admin terminal cookie', async () => {
    process.env['VANBLOG_AI_TERMINAL_ENABLED'] = 'true';
    const { provider } = createProvider();
    const response = {
      cookie: jest.fn(),
    } as any;
    const request = {
      headers: {
        'x-forwarded-proto': 'https',
      },
      secure: true,
    } as any;

    await provider.openSession({ id: 0 }, request, response);
    const issuedToken = response.cookie.mock.calls[0][1];

    await expect(
      provider.authorizeRequest({
        headers: {
          cookie: `vanblog_ai_terminal=${issuedToken}`,
        },
      } as any),
    ).resolves.toEqual({
      ok: true,
      userId: 0,
    });
  });

  it('rejects missing or forged terminal cookies', async () => {
    process.env['VANBLOG_AI_TERMINAL_ENABLED'] = 'true';
    const { provider } = createProvider();

    await expect(provider.authorizeRequest({ headers: {} } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      provider.authorizeRequest({
        headers: {
          cookie: 'vanblog_ai_terminal=forged-token',
        },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a cookie after the admin permission disappears', async () => {
    process.env['VANBLOG_AI_TERMINAL_ENABLED'] = 'true';
    const { provider } = createProvider({
      userProvider: {
        getUser: jest.fn().mockResolvedValue(null),
      },
    });
    const response = {
      cookie: jest.fn(),
    } as any;

    const healthyProvider = createProvider().provider;
    await healthyProvider.openSession({ id: 0 }, { headers: {}, secure: false } as any, response);
    const issuedToken = response.cookie.mock.calls[0][1];

    await expect(
      provider.authorizeRequest({
        headers: {
          cookie: `vanblog_ai_terminal=${issuedToken}`,
        },
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns not found from auth when the terminal overlay is disabled', async () => {
    const { provider } = createProvider();

    await expect(
      provider.authorizeRequest({
        headers: {
          cookie: 'vanblog_ai_terminal=token',
        },
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
