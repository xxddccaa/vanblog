import { config } from 'src/config';
import { CommentController } from './comment.controller';

const createController = () => {
  const commentProvider = {
    listAdmin: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    getStats: jest.fn().mockResolvedValue({ pending: 1 }),
    updateAdmin: jest.fn().mockResolvedValue({ id: 3 }),
    batch: jest.fn().mockResolvedValue({ updated: 1, failed: [] }),
    purge: jest.fn().mockResolvedValue({ purged: 2 }),
    softDelete: jest.fn().mockResolvedValue({ id: 3, status: 'deleted' }),
    replyAsAdmin: jest.fn().mockResolvedValue({ id: 9 }),
    afterSettingChanged: jest.fn(),
  };
  const settingProvider = {
    getAdminCommentSetting: jest.fn().mockResolvedValue({ moderation: 'suspicious' }),
    updateCommentSetting: jest.fn().mockResolvedValue({ moderation: 'all' }),
  };
  const requestService = {
    getSuperAdmin: jest.fn().mockResolvedValue({ nick: 'Owner' }),
    requestIp: jest.fn().mockReturnValue('127.0.0.1'),
    userAgent: jest.fn().mockReturnValue('Admin UA'),
  };
  const controller = new CommentController(
    commentProvider as any,
    settingProvider as any,
    requestService as any,
  );
  return { controller, commentProvider, settingProvider, requestService };
};

describe('CommentController (admin)', () => {
  const previousDemo = config.demo;

  afterEach(() => {
    config.demo = previousDemo;
  });

  it('delegates reads to the provider and the setting store', async () => {
    const { controller, commentProvider } = createController();
    await expect(controller.list({ status: 'pending', page: '2' })).resolves.toEqual({
      statusCode: 200,
      data: { items: [], total: 0, page: 1, pageSize: 20 },
    });
    expect(commentProvider.listAdmin).toHaveBeenCalledWith({ status: 'pending', page: '2' });
    await expect(controller.stats()).resolves.toEqual({ statusCode: 200, data: { pending: 1 } });
    await expect(controller.getSetting()).resolves.toEqual({
      statusCode: 200,
      data: { moderation: 'suspicious' },
    });
  });

  it('delegates writes and reports setting changes', async () => {
    const { controller, commentProvider, settingProvider } = createController();
    await expect(controller.updateSetting({ moderation: 'all' })).resolves.toEqual({
      statusCode: 200,
      data: { moderation: 'all' },
    });
    expect(settingProvider.updateCommentSetting).toHaveBeenCalledWith({ moderation: 'all' });
    expect(commentProvider.afterSettingChanged).toHaveBeenCalled();
    await controller.update('3', { status: 'approved' });
    expect(commentProvider.updateAdmin).toHaveBeenCalledWith('3', { status: 'approved' });
    await controller.batch({ ids: [1], action: 'spam' });
    expect(commentProvider.batch).toHaveBeenCalledWith({ ids: [1], action: 'spam' });
    await expect(controller.remove('3')).resolves.toEqual({
      statusCode: 200,
      data: { id: 3, status: 'deleted' },
    });
    await expect(controller.purge('3')).resolves.toEqual({ statusCode: 200, data: { purged: 2 } });
  });

  it('replies with the super admin identity and request metadata', async () => {
    const { controller, commentProvider, requestService } = createController();
    const req = { user: { id: 0, nickname: 'From JWT' } } as any;
    await controller.reply('4', { content: 'hi' }, req);
    expect(commentProvider.replyAsAdmin).toHaveBeenCalledWith(
      '4',
      { content: 'hi' },
      { nick: 'Owner', ip: '127.0.0.1', ua: 'Admin UA' },
    );
    requestService.getSuperAdmin.mockResolvedValue(null);
    await controller.reply('4', { content: 'hi' }, req);
    expect(commentProvider.replyAsAdmin).toHaveBeenLastCalledWith(
      '4',
      { content: 'hi' },
      expect.objectContaining({ nick: 'From JWT' }),
    );
  });

  it('blocks every write on the demo site', async () => {
    config.demo = 'true' as any;
    const { controller, commentProvider, settingProvider } = createController();
    const blocked = expect.objectContaining({ statusCode: 401 });
    await expect(controller.updateSetting({})).resolves.toEqual(blocked);
    await expect(controller.batch({})).resolves.toEqual(blocked);
    await expect(controller.update('1', {})).resolves.toEqual(blocked);
    await expect(controller.purge('1')).resolves.toEqual(blocked);
    await expect(controller.remove('1')).resolves.toEqual(blocked);
    await expect(controller.reply('1', {}, {} as any)).resolves.toEqual(blocked);
    expect(settingProvider.updateCommentSetting).not.toHaveBeenCalled();
    expect(Object.values(commentProvider).every((fn: any) => fn.mock.calls.length === 0)).toBe(
      true,
    );
    await expect(controller.list({})).resolves.toEqual(
      expect.objectContaining({ statusCode: 200 }),
    );
  });
});
