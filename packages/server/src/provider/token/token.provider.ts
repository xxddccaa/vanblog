import { Injectable, Logger } from '@nestjs/common';

import { TokenDocument } from 'src/scheme/token.schema';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { JwtService } from '@nestjs/jwt';
import { SettingProvider } from '../setting/setting.provider';
import { StructuredDataService } from 'src/storage/structured-data.service';
import { createHash } from 'node:crypto';

const API_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 90;

function getStoredToken(token: string) {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

@Injectable()
export class TokenProvider {
  logger = new Logger(TokenProvider.name);
  timer = null;
  constructor(
    @InjectModel('Token') private tokenModel: Model<TokenDocument>,
    private readonly jwtService: JwtService,
    private readonly settingProvider: SettingProvider,
    private readonly structuredDataService: StructuredDataService,
  ) {}

  async getAllAPIToken() {
    this.logger.log(`获取所有 API Token`);
    const tokens = await this.structuredDataService.listTokens({ userId: 666666, disabled: false });
    if (tokens.length || this.structuredDataService.isInitialized()) {
      return tokens.map(({ token: _token, ...item }) => item) as any;
    }
    const mongoTokens = await this.tokenModel
      .find({ userId: 666666, disabled: false })
      .lean()
      .exec();
    return mongoTokens.map(({ token: _token, ...item }) => item);
  }
  async getAllTokens() {
    const tokens = await this.structuredDataService.listTokens();
    if (tokens.length || this.structuredDataService.isInitialized()) {
      return tokens as any;
    }
    return await this.tokenModel.find({}).lean().exec();
  }
  async importTokens(tokens: any[]) {
    for (const token of tokens || []) {
      if (!token?.token) {
        continue;
      }

      const payload = { ...token };
      delete payload._id;
      delete payload.__v;

      await this.tokenModel.updateOne({ token: token.token }, payload, { upsert: true });
      await this.structuredDataService.upsertToken(payload);
    }
  }

  async disableAPIToken(token: string) {
    const storedToken = getStoredToken(token);
    const result = await this.tokenModel.updateOne(
      { token: { $in: [storedToken, token] } },
      { disabled: true },
    );
    await this.structuredDataService.updateTokenDisabledByToken(storedToken, true);
    await this.structuredDataService.updateTokenDisabledByToken(token, true);
    return result;
  }
  async disableAPITokenByName(name: string) {
    const result = await this.tokenModel.updateOne({ name }, { disabled: true });
    await this.structuredDataService.updateTokenDisabledByName(name, true);
    return result;
  }
  async disableAPITokenById(id: string) {
    const result = await this.tokenModel.updateOne({ _id: id }, { disabled: true });
    await this.structuredDataService.updateTokenDisabledByRecordId(id, true);
    return result;
  }

  async createAPIToken(name: string) {
    this.logger.log(`创建 API Token`);
    const expiresIn = API_TOKEN_EXPIRES_IN_SECONDS;
    const token = this.jwtService.sign(
      {
        sub: 0,
        username: name,
        role: 'admin',
      },
      {
        expiresIn,
      },
    );
    // 默认666666是 api token
    const storedToken = getStoredToken(token);
    const created = await this.tokenModel.create({
      userId: 666666,
      name,
      token: storedToken,
      expiresIn,
    });
    await this.structuredDataService.upsertToken(created.toObject ? created.toObject() : created);
    return token;
  }

  async createToken(payload: any) {
    this.logger.debug(`用户 ${payload.username} 登录，创建 Token。`);
    const loginSetting = await this.settingProvider.getLoginSetting();
    const expiresIn = loginSetting?.expiresIn || 3600 * 24 * 7;
    const token = this.jwtService.sign(payload, {
      expiresIn,
    });
    const created = await this.tokenModel.create({
      userId: payload.sub,
      token: getStoredToken(token),
      expiresIn,
    });
    await this.structuredDataService.upsertToken(created.toObject ? created.toObject() : created);
    return token;
  }
  async disableToken(token: string) {
    const storedToken = getStoredToken(token);
    const result = await this.tokenModel.updateOne(
      { token: { $in: [storedToken, token] } },
      { disabled: true },
    );
    await this.structuredDataService.updateTokenDisabledByToken(storedToken, true);
    await this.structuredDataService.updateTokenDisabledByToken(token, true);
    return result;
  }
  async disableAll() {
    const result = await this.tokenModel.updateMany({ disabled: false }, { disabled: true });
    await this.structuredDataService.updateTokensDisabledByUserFilters({ disabled: false });
    return result;
  }
  async disableAllAdmin() {
    const result = await this.tokenModel.updateMany({ disabled: false, userId: 0 }, { disabled: true });
    await this.structuredDataService.updateTokensDisabledByUserFilters({
      disabled: false,
      userId: 0,
    });
    return result;
  }
  async disableAllCollaborator() {
    const result = await this.tokenModel.updateMany(
      { disabled: false, userId: { $ne: 0 } },
      { disabled: true },
    );
    await this.structuredDataService.updateTokensDisabledByUserFilters({
      disabled: false,
      userIdNot: 0,
    });
    return result;
  }
  async disableByUserId(id: number) {
    const result = await this.tokenModel.updateMany({ disabled: false, userId: id }, { disabled: true });
    await this.structuredDataService.updateTokensDisabledByUserFilters({
      disabled: false,
      userId: id,
    });
    return result;
  }

  async getValidTokenPayload(token: string) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const storedToken = getStoredToken(token);
    const pgToken =
      (await this.structuredDataService.getTokenByToken(storedToken)) ||
      (await this.structuredDataService.getTokenByToken(token));
    if (pgToken || this.structuredDataService.isInitialized()) {
      if (!pgToken || pgToken.disabled) {
        return null;
      }
      try {
        return await this.jwtService.verifyAsync(token, { secret: global.jwtSecret });
      } catch {
        return null;
      }
    }

    const result = await this.tokenModel.findOne({
      token: { $in: [storedToken, token] },
      disabled: false,
    });
    if (!result?.token) {
      return null;
    }
    try {
      return await this.jwtService.verifyAsync(token, { secret: global.jwtSecret });
    } catch {
      return null;
    }
  }

  async checkToken(token: string) {
    return Boolean(await this.getValidTokenPayload(token));
  }

  private async getActiveTokenRecord(token: string) {
    const storedToken = getStoredToken(token);
    const pgToken =
      (await this.structuredDataService.getTokenByToken(storedToken)) ||
      (await this.structuredDataService.getTokenByToken(token));
    if (pgToken || this.structuredDataService.isInitialized()) {
      if (!pgToken || pgToken.disabled) {
        return null;
      }
      return pgToken as any;
    }

    const result = await this.tokenModel
      .findOne({ token: { $in: [storedToken, token] }, disabled: false })
      .lean()
      .exec();
    return result || null;
  }

  async checkAdminToken(token: string) {
    const payload = await this.getValidTokenPayload(token);
    if (!payload) {
      return false;
    }
    return payload.sub === 0 || payload.type === 'admin' || payload.role === 'admin';
  }

  async checkSuperAdminSessionToken(token: string) {
    const tokenRecord = await this.getActiveTokenRecord(token);
    if (!tokenRecord || tokenRecord.userId !== 0) {
      return false;
    }
    const payload = await this.getValidTokenPayload(token);
    if (!payload) {
      return false;
    }
    return payload.sub === 0 || payload.type === 'admin';
  }
}
