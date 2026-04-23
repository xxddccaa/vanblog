import { UnauthorizedException } from '@nestjs/common';
import { AiQaTerminalAuthController } from './ai-qa-terminal-auth.controller';
import { AiQaTerminalController } from './ai-qa-terminal.controller';

describe('AiQaTerminalController', () => {
  const createControllers = (overrides: Record<string, any> = {}) => {
    const aiQaTerminalProvider = {
      getStatus: jest.fn().mockReturnValue({
        enabled: true,
        entryPath: '/admin/ai-terminal',
        workspacePath: '/workspace/vanblog',
        homePath: '/app/ai-terminal-home',
        tools: ['opencode', 'git'],
      }),
      openSession: jest.fn().mockResolvedValue({
        enabled: true,
        entryPath: '/admin/ai-terminal',
      }),
      clearSession: jest.fn().mockReturnValue({ cleared: true }),
      authorizeRequest: jest.fn().mockResolvedValue({ ok: true, userId: 0 }),
      ...overrides.aiQaTerminalProvider,
    };

    return {
      controller: new AiQaTerminalController(aiQaTerminalProvider as any),
      authController: new AiQaTerminalAuthController(aiQaTerminalProvider as any),
      aiQaTerminalProvider,
    };
  };

  it('delegates status, open-session, and clear-session to the provider', async () => {
    const { controller, aiQaTerminalProvider } = createControllers();
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    const request = {
      user: { id: 0, name: 'admin' },
      headers: {
        'x-forwarded-proto': 'https',
      },
      secure: true,
    };

    expect(controller.getStatus()).toEqual({
      statusCode: 200,
      data: {
        enabled: true,
        entryPath: '/admin/ai-terminal',
        workspacePath: '/workspace/vanblog',
        homePath: '/app/ai-terminal-home',
        tools: ['opencode', 'git'],
      },
    });
    await expect(controller.openSession(request as any, response as any)).resolves.toEqual({
      statusCode: 200,
      data: {
        enabled: true,
        entryPath: '/admin/ai-terminal',
      },
    });
    expect(controller.clearSession(request as any, response as any)).toEqual({
      statusCode: 200,
      data: { cleared: true },
    });

    expect(aiQaTerminalProvider.openSession).toHaveBeenCalledWith(request.user, request, response);
    expect(aiQaTerminalProvider.clearSession).toHaveBeenCalledWith(request, response);
  });

  it('keeps the auth endpoint independent from the admin guard token header', async () => {
    const { authController, aiQaTerminalProvider } = createControllers();
    const request = {
      headers: {
        cookie: 'vanblog_ai_terminal=session-token',
      },
    };

    await expect(authController.auth(request as any)).resolves.toEqual({
      statusCode: 200,
      data: { ok: true, userId: 0 },
    });

    expect(aiQaTerminalProvider.authorizeRequest).toHaveBeenCalledWith(request);
  });

  it('surfaces auth failures from the provider', async () => {
    const { authController } = createControllers({
      aiQaTerminalProvider: {
        authorizeRequest: jest
          .fn()
          .mockRejectedValue(new UnauthorizedException('AI 终端会话已失效')),
      },
    });

    await expect(authController.auth({ headers: {} } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
