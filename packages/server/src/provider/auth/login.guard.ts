import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import dayjs from 'dayjs';
import { Request } from 'express';
import { CacheProvider } from '../cache/cache.provider';
import { getRequestIp } from '../log/utils';
import { SettingProvider } from '../setting/setting.provider';

const DEFAULT_MAX_RETRY_TIMES = 3;
const DEFAULT_DURATION_SECONDS = 60;

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
  async validateRequest(request: Request) {
    const loginSetting = await this.settingProvider.getLoginSetting();
    if (!loginSetting?.enableMaxLoginRetry) {
      return true;
    }
    const maxRetryTimes = this.toPositiveInt(loginSetting.maxRetryTimes, DEFAULT_MAX_RETRY_TIMES);
    const durationSeconds = this.toPositiveInt(
      loginSetting.durationSeconds,
      DEFAULT_DURATION_SECONDS,
    );

    const ip = getRequestIp(request) || 'unknown';
    const key = `login-${ip}`;
    const cacheEntry = (await this.cacheProvider.get(key)) || {};
    const { lastLoginTime } = cacheEntry;
    const count = this.toPositiveInt(cacheEntry.count, 0);
    const parsedLastLoginTime = dayjs(lastLoginTime);
    const windowExpired =
      !lastLoginTime ||
      !parsedLastLoginTime.isValid() ||
      dayjs().diff(parsedLastLoginTime, 'seconds') > durationSeconds;

    if (windowExpired || count <= 0) {
      await this.cacheProvider.set(key, { count: 1, lastLoginTime: new Date() }, durationSeconds);
      return true;
    }

    const blocked = count >= maxRetryTimes;
    if (blocked) {
      this.logger.warn(
        `登录频繁失败检测触发\nip: ${ip}\ncount: ${count}\nmaxRetryTimes: ${maxRetryTimes}\nlastLoginTime: ${lastLoginTime}\ndurationSeconds: ${durationSeconds}`,
      );
    }
    await this.cacheProvider.set(
      key,
      { count: count + 1, lastLoginTime: new Date() },
      durationSeconds,
    );
    if (blocked) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: `错误次数过多！请 ${durationSeconds} 秒之后再试！`,
      });
    }
    return true;
  }
}
