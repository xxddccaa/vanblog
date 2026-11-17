import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { CacheProvider } from '../cache/cache.provider';
import { getRateLimitBucket, getRequestIp } from '../log/utils';
import { SettingProvider } from '../setting/setting.provider';

const DEFAULT_MAX_RETRY_TIMES = 3;
const DEFAULT_DURATION_SECONDS = 60;

/**
 * Always-on floor that applies even when the configurable limit is disabled,
 * so the admin login can never be brute forced at full speed.
 */
export const LOGIN_BASELINE_MAX_ATTEMPTS = 10;
export const LOGIN_BASELINE_WINDOW_SECONDS = 10 * 60;

/** Cache keys holding the login attempt counters for this request's client. */
export function getLoginRetryKeys(request: any) {
  const bucket = getRateLimitBucket(getRequestIp(request));
  return {
    configurable: `login-${bucket}`,
    baseline: `login-baseline-${bucket}`,
  };
}

@Injectable()
export class LoginGuard implements CanActivate {
  logger = new Logger(LoginGuard.name);
  constructor(
    private cacheProvider: CacheProvider,
    private settingProvider: SettingProvider,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    return await this.validateRequest(request);
  }
  // The login setting API stores the request body as-is, so every value read
  // here has to be normalized before it can be used as a limit.
  private toPositiveInt(value: unknown, fallback: number) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private reject(ip: string, count: number, limit: number, windowSeconds: number) {
    this.logger.warn(
      `Too many login attempts: ip=${ip} count=${count} limit=${limit} window=${windowSeconds}s`,
    );
    throw new UnauthorizedException({
      statusCode: 401,
      message: `错误次数过多！请 ${windowSeconds} 秒之后再试！`,
    });
  }

  async validateRequest(request: Request) {
    const ip = getRequestIp(request) || 'unknown';
    const keys = getLoginRetryKeys(request);

    // Counters are incremented atomically before the password is checked, so
    // parallel guesses cannot all slip through a read-then-write window.
    const baselineCount = await this.cacheProvider.incrementWithTtl(
      keys.baseline,
      LOGIN_BASELINE_WINDOW_SECONDS,
    );
    if (baselineCount > LOGIN_BASELINE_MAX_ATTEMPTS) {
      this.reject(ip, baselineCount, LOGIN_BASELINE_MAX_ATTEMPTS, LOGIN_BASELINE_WINDOW_SECONDS);
    }

    const loginSetting = await this.settingProvider.getLoginSetting();
    // Enabled unless the owner explicitly turned it off.
    if (loginSetting?.enableMaxLoginRetry === false) {
      return true;
    }
    const maxRetryTimes = this.toPositiveInt(loginSetting?.maxRetryTimes, DEFAULT_MAX_RETRY_TIMES);
    const durationSeconds = this.toPositiveInt(
      loginSetting?.durationSeconds,
      DEFAULT_DURATION_SECONDS,
    );
    const count = await this.cacheProvider.incrementWithTtl(keys.configurable, durationSeconds);
    if (count > maxRetryTimes) {
      this.reject(ip, count, maxRetryTimes, durationSeconds);
    }
    return true;
  }
}
