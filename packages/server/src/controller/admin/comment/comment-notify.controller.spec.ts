import { HttpException } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { config } from 'src/config';
import { commentError } from 'src/provider/comment/comment-request.service';
import { CommentNotifyController } from './comment-notify.controller';

describe('CommentNotifyController', () => {
  const notifyProvider = { sendTestMail: jest.fn() };
  const controller = new CommentNotifyController(notifyProvider as any);
  const originalDemo = config.demo;

  beforeEach(() => {
    jest.clearAllMocks();
    config.demo = false;
  });

  afterAll(() => {
    config.demo = originalDemo;
  });

  it('is mounted at POST /api/admin/comment/notify/test behind the admin guards', () => {
    expect(Reflect.getMetadata(PATH_METADATA, CommentNotifyController)).toBe(
      '/api/admin/comment/notify',
    );
    const handler = CommentNotifyController.prototype.sendTest;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/test');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(GUARDS_METADATA, CommentNotifyController)).toHaveLength(3);
  });

  it('sends the test email and reports success', async () => {
    notifyProvider.sendTestMail.mockResolvedValue(undefined);
    await expect(controller.sendTest({ to: 'admin@example.com' })).resolves.toEqual({
      statusCode: 200,
      data: { sent: true },
    });
    expect(notifyProvider.sendTestMail).toHaveBeenCalledWith('admin@example.com');
  });

  it('passes coded failures through', async () => {
    notifyProvider.sendTestMail.mockRejectedValue(
      commentError(400, 'COMMENT_NOTIFY_FAILED', 'Sending the email failed'),
    );
    const error = await controller.sendTest({ to: 'admin@example.com' }).catch((err) => err);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
    expect(((error as HttpException).getResponse() as any).code).toBe('COMMENT_NOTIFY_FAILED');
  });

  it('tolerates a missing body', async () => {
    notifyProvider.sendTestMail.mockResolvedValue(undefined);
    await controller.sendTest(undefined as any);
    expect(notifyProvider.sendTestMail).toHaveBeenCalledWith(undefined);
  });

  it('refuses to send from the demo site', async () => {
    config.demo = 'true';
    await expect(controller.sendTest({ to: 'admin@example.com' })).resolves.toEqual({
      statusCode: 401,
      message: expect.any(String),
    });
    expect(notifyProvider.sendTestMail).not.toHaveBeenCalled();
  });
});
