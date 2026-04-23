import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions, Request, Response } from 'express';
import { UserProvider } from 'src/provider/user/user.provider';
import { AiQaTerminalAuthResult, AiQaTerminalStatus } from 'src/types/ai-qa.dto';

const AI_TERMINAL_COOKIE_NAME = 'vanblog_ai_terminal';
const AI_TERMINAL_ENTRY_PATH = '/admin/ai-terminal';
const AI_TERMINAL_WORKSPACE_PATH = '/workspace/vanblog';
const AI_TERMINAL_HOME_PATH = '/app/ai-terminal-home';
const AI_TERMINAL_TOKEN_PURPOSE = 'ai-terminal';
const AI_TERMINAL_TOKEN_EXPIRES_IN = 60 * 60 * 12;
const AI_TERMINAL_TOOLS = ['opencode', 'python3', 'pip', 'git', 'rg', 'tmux', 'bash'];

@Injectable()
export class AiQaTerminalProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userProvider: UserProvider,
  ) {}

  private resolveEnabledFlag() {
    const rawValue =
      process.env['VANBLOG_AI_TERMINAL_ENABLED'] ?? process.env['VAN_BLOG_AI_TERMINAL_ENABLED'];
    return ['1', 'true', 'yes', 'on'].includes(
      String(rawValue || '')
        .trim()
        .toLowerCase(),
    );
  }

  private buildCookieOptions(request?: Request): CookieOptions {
    const forwardedProto = request?.headers?.['x-forwarded-proto'];
    const normalizedProto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : String(forwardedProto || '')
          .split(',')[0]
          .trim();
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(request?.secure || normalizedProto === 'https'),
      path: AI_TERMINAL_ENTRY_PATH,
    };
  }

  private readCookieValue(cookieHeader: string | string[] | undefined, key: string) {
    const rawCookie = Array.isArray(cookieHeader)
      ? cookieHeader.join('; ')
      : String(cookieHeader || '');
    if (!rawCookie) {
      return '';
    }
    for (const pair of rawCookie.split(';')) {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }
      const cookieKey = pair.slice(0, separatorIndex).trim();
      if (cookieKey !== key) {
        continue;
      }
      return decodeURIComponent(pair.slice(separatorIndex + 1).trim());
    }
    return '';
  }

  private async ensureActiveAdmin(userId: number) {
    if (!Number.isInteger(userId) || userId < 0) {
      return null;
    }

    if (userId === 0) {
      const user = await this.userProvider.getUser();
      if (!user) {
        return null;
      }
      return {
        id: 0,
        type: 'admin',
      };
    }

    const collaborator = await this.userProvider.getCollaboratorById(userId);
    const permissions = Array.isArray((collaborator as any)?.permissions)
      ? (collaborator as any).permissions
      : [];
    if (!collaborator || !permissions.includes('all')) {
      return null;
    }
    return {
      id: userId,
      type: 'collaborator',
    };
  }

  private ensureEnabled() {
    if (!this.resolveEnabledFlag()) {
      throw new BadRequestException('当前部署未启用 AI 终端');
    }
  }

  getStatus(): AiQaTerminalStatus {
    return {
      enabled: this.resolveEnabledFlag(),
      entryPath: AI_TERMINAL_ENTRY_PATH,
      workspacePath: AI_TERMINAL_WORKSPACE_PATH,
      homePath: AI_TERMINAL_HOME_PATH,
      tools: [...AI_TERMINAL_TOOLS],
    };
  }

  async openSession(user: any, request: Request, response: Response) {
    this.ensureEnabled();

    const userId = Number(user?.id);
    const activeAdmin = await this.ensureActiveAdmin(userId);
    if (!activeAdmin) {
      throw new UnauthorizedException('当前管理员会话无效');
    }

    const token = await this.jwtService.signAsync(
      {
        purpose: AI_TERMINAL_TOKEN_PURPOSE,
        userId: activeAdmin.id,
        type: activeAdmin.type,
      },
      {
        secret: global.jwtSecret,
        expiresIn: AI_TERMINAL_TOKEN_EXPIRES_IN,
      },
    );

    response.cookie(AI_TERMINAL_COOKIE_NAME, token, this.buildCookieOptions(request));
    return this.getStatus();
  }

  clearSession(request: Request, response: Response) {
    response.clearCookie(AI_TERMINAL_COOKIE_NAME, this.buildCookieOptions(request));
    return {
      cleared: true,
    };
  }

  async authorizeRequest(request: Request): Promise<AiQaTerminalAuthResult> {
    if (!this.resolveEnabledFlag()) {
      throw new NotFoundException('当前部署未启用 AI 终端');
    }

    const token = this.readCookieValue(request?.headers?.cookie, AI_TERMINAL_COOKIE_NAME);
    if (!token) {
      throw new UnauthorizedException('缺少 AI 终端会话');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: global.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('AI 终端会话已失效');
    }

    if (payload?.purpose !== AI_TERMINAL_TOKEN_PURPOSE) {
      throw new UnauthorizedException('AI 终端会话无效');
    }

    const userId = Number(payload?.userId);
    const activeAdmin = await this.ensureActiveAdmin(userId);
    if (!activeAdmin) {
      throw new UnauthorizedException('当前管理员权限已失效');
    }

    return {
      ok: true,
      userId: activeAdmin.id,
    };
  }
}
