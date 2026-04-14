import { UserProvider } from './user.provider';
import { encryptPassword } from 'src/utils/crypto';

describe('UserProvider', () => {
  it('does not fall back to the model when structured users are initialized but empty', async () => {
    const userModel = {
      find: jest.fn(),
    };
    const provider = new UserProvider(
      userModel as any,
      {
        listUsers: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const users = await provider.getAllUsers();

    expect(users).toEqual([]);
    expect(userModel.find).not.toHaveBeenCalled();
  });

  it('does not re-check the legacy model when PG user validation fails after initialization', async () => {
    const userModel = {
      findOne: jest.fn(),
    };
    const provider = new UserProvider(
      userModel as any,
      {
        getUserByName: jest.fn().mockResolvedValue({
          id: 1,
          name: 'dong',
          salt: 'salt',
          password: 'stored-hash',
        }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    const result = await provider.validateUser('dong', 'wrong-password');

    expect(result).toBeNull();
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('keeps login successful even if salt refresh fails after authentication', async () => {
    const provider = new UserProvider(
      {
        findOne: jest.fn(),
      } as any,
      {
        getUserByName: jest.fn().mockResolvedValue({
          id: 1,
          name: 'dong',
          salt: 'salt',
          password: encryptPassword('dong', 'wrong-password', 'salt'),
        }),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );
    const updateSaltSpy = jest
      .spyOn(provider, 'updateSalt')
      .mockRejectedValue(new Error('write failed'));
    const warnSpy = jest.spyOn(provider.logger, 'warn').mockImplementation(() => undefined);

    const result = await provider.validateUser('dong', 'wrong-password');

    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        name: 'dong',
      }),
    );
    expect(updateSaltSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'wrong-password');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('登录后刷新用户盐值失败'));
  });

  it('rejects empty username or password when updating the current user', async () => {
    const provider = new UserProvider(
      {
        updateOne: jest.fn(),
      } as any,
      {
        getUserById: jest.fn(),
        isInitialized: jest.fn().mockReturnValue(true),
      } as any,
    );

    await expect(provider.updateUser({ name: '', password: 'secret' } as any)).rejects.toThrow(
      '用户名和密码不能为空',
    );
    await expect(provider.updateUser({ name: 'admin', password: '   ' } as any)).rejects.toThrow(
      '用户名和密码不能为空',
    );
  });
});
