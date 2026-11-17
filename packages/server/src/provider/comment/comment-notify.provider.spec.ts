jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

import { HttpException, Logger } from '@nestjs/common';
import axios from 'axios';
import nodemailer from 'nodemailer';
import {
  COMMENT_NOTIFY_LIMITS,
  CommentHookContext,
  CommentRecord,
  CommentSetting,
  CommentSmtpSetting,
  ResolvedCommentTarget,
  defaultCommentSetting,
} from 'src/types/comment.dto';
import {
  COMMENT_NOTIFY_TEST_LIMIT,
  COMMENT_WEBHOOK_USER_AGENT,
  CommentMailTransport,
  CommentNotifyProvider,
  describeSmtpError,
} from './comment-notify.provider';

const OWNER = 'owner@example.com';
const VISITOR_IP = '198.51.100.77';
const VISITOR_UA = 'SecretAgent/9.9 (FingerprintMe)';

const target: ResolvedCommentTarget = {
  type: 'post',
  id: '12',
  key: 'post:12',
  title: 'Hello <World>',
  url: '/post/hello-world',
  articleId: 12,
};

let nextId = 100;
const makeComment = (overrides: Partial<CommentRecord> = {}): CommentRecord => ({
  id: nextId++,
  targetType: 'post',
  targetId: '12',
  parentId: null,
  rootId: null,
  replyToNick: null,
  nick: 'Alice',
  mail: 'alice@example.com',
  link: 'https://alice.example.com',
  content: 'Nice post! <script>alert(1)</script>',
  status: 'approved',
  isAdmin: false,
  pinned: false,
  likes: 0,
  ip: VISITOR_IP,
  ua: VISITOR_UA,
  location: 'Somewhere',
  browser: 'Chrome 131',
  os: 'Windows 10',
  images: [],
  createdAt: new Date('2026-11-17T10:00:00.000Z'),
  updatedAt: new Date('2026-11-17T10:00:00.000Z'),
  ...overrides,
});

const makeSetting = (): CommentSetting => {
  const setting: CommentSetting = JSON.parse(JSON.stringify(defaultCommentSetting));
  setting.notify.ownerEmail = OWNER;
  setting.notify.webhook = 'https://hooks.example.com/comment';
  setting.notify.smtp = {
    enabled: true,
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    user: 'mailer@example.com',
    pass: 'super-secret-password',
    fromName: '',
    fromEmail: 'noreply@example.com',
  };
  return setting;
};

class TestNotifyProvider extends CommentNotifyProvider {
  sent: Array<Record<string, any>> = [];
  transports: CommentSmtpSetting[] = [];
  sendImpl: (message: Record<string, any>) => Promise<unknown> = async () => ({});
  protected createTransport(smtp: CommentSmtpSetting): CommentMailTransport {
    this.transports.push(smtp);
    return {
      sendMail: async (message) => {
        this.sent.push(message);
        return this.sendImpl(message);
      },
      close: jest.fn(),
    };
  }
}

describe('CommentNotifyProvider', () => {
  let setting: CommentSetting;
  let siteInfo: any;
  let counters: Map<string, number>;
  let flags: Set<string>;
  const settingProvider = { getCommentSetting: jest.fn() };
  const metaProvider = { getSiteInfo: jest.fn() };
  const cacheProvider = {
    incrementWithTtl: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
    setIfAbsent: jest.fn(async (key: string) => {
      if (flags.has(key)) return false;
      flags.add(key);
      return true;
    }),
  };
  const pipelineProvider = { dispatchEvent: jest.fn() };
  const post = axios.post as jest.Mock;
  let provider: TestNotifyProvider;

  const recipients = () => provider.sent.map((message) => message.to);
  const create = async (comment: CommentRecord, context: Partial<CommentHookContext> = {}) => {
    provider.afterCreate(comment, { target, ...context });
    await provider.drain();
  };
  const approve = async (comment: CommentRecord, context: Partial<CommentHookContext> = {}) => {
    provider.afterApprove(comment, { target, ...context });
    await provider.drain();
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setting = makeSetting();
    siteInfo = { siteName: 'Test Blog', baseUrl: 'https://blog.example.com/' };
    counters = new Map();
    flags = new Set();
    settingProvider.getCommentSetting.mockImplementation(async () => setting);
    metaProvider.getSiteInfo.mockImplementation(async () => siteInfo);
    pipelineProvider.dispatchEvent.mockResolvedValue([]);
    post.mockResolvedValue({ status: 200, data: '' });
    provider = new TestNotifyProvider(
      settingProvider as any,
      metaProvider as any,
      cacheProvider as any,
      pipelineProvider as any,
    );
  });

  describe('hooks', () => {
    it('return immediately and defer all work', () => {
      const result = provider.afterCreate(makeComment(), { target });
      expect(result).toBeUndefined();
      expect(settingProvider.getCommentSetting).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      return provider.drain();
    });

    it('never reject or throw when everything fails', async () => {
      settingProvider.getCommentSetting.mockRejectedValue(new Error('database down'));
      expect(() => provider.afterCreate(makeComment(), { target })).not.toThrow();
      expect(() => provider.afterApprove(makeComment(), { target })).not.toThrow();
      await expect(provider.drain()).resolves.toBeUndefined();
      expect(provider.sent).toEqual([]);
    });

    it('tolerate a missing context', async () => {
      provider.afterCreate(makeComment(), undefined as any);
      await expect(provider.drain()).resolves.toBeUndefined();
    });
  });

  describe('owner email', () => {
    it('notifies the owner about a new visitor comment', async () => {
      const comment = makeComment();
      await create(comment);
      expect(recipients()).toEqual([OWNER]);
      const [message] = provider.sent;
      expect(message.subject).toContain('Test Blog');
      expect(message.subject).toContain('有新评论');
      expect(message.text).toContain(
        `https://blog.example.com/post/hello-world#comment-${comment.id}`,
      );
      expect(message.text).toContain('管理评论：https://blog.example.com/admin/site/comment\n');
    });

    it.each([
      ['pending', '待审核'],
      ['spam', '疑似垃圾'],
    ] as const)('marks a %s comment and links to the moderation queue', async (status, marker) => {
      await create(makeComment({ status }));
      expect(provider.sent).toHaveLength(1);
      expect(provider.sent[0].subject).toContain(marker);
      expect(provider.sent[0].text).toContain(
        'https://blog.example.com/admin/site/comment?status=pending',
      );
      expect(provider.sent[0].html).toContain(
        'href="https://blog.example.com/admin/site/comment?status=pending"',
      );
    });

    it('is not sent for comments written by the admin', async () => {
      await create(makeComment({ isAdmin: true, mail: '' }));
      expect(provider.sent).toEqual([]);
    });

    it('respects notifyOwner and a missing owner address', async () => {
      setting.notify.notifyOwner = false;
      await create(makeComment());
      setting.notify.notifyOwner = true;
      setting.notify.ownerEmail = '';
      await create(makeComment());
      expect(provider.sent).toEqual([]);
    });

    it('escapes every dynamic value in the HTML part', async () => {
      siteInfo.siteName = 'Blog <b>"x"</b>';
      await create(makeComment({ nick: '<img src=x onerror=alert(1)>' }));
      const { html } = provider.sent[0];
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('Hello &lt;World&gt;');
    });

    it('omits links when the site has no usable base URL', async () => {
      siteInfo.baseUrl = 'javascript:alert(1)';
      await create(makeComment());
      const [message] = provider.sent;
      expect(message.text).not.toMatch(/https?:\/\//u);
      expect(message.html).not.toContain('href=');
    });
  });

  describe('reply email', () => {
    const parentOf = (overrides: Partial<CommentRecord> = {}) =>
      makeComment({
        nick: 'Bob',
        mail: 'Bob@Example.com',
        content: 'Original words',
        ...overrides,
      });

    it('notifies the parent author about an approved reply', async () => {
      const parent = parentOf();
      const reply = makeComment({ parentId: parent.id, rootId: parent.id, replyToNick: 'Bob' });
      await create(reply, { parent });
      expect(recipients().sort()).toEqual(['Bob@Example.com', OWNER].sort());
      const replyMail = provider.sent.find((message) => message.to === 'Bob@Example.com');
      expect(replyMail.subject).toContain('新回复');
      expect(replyMail.text).toContain('Original words');
      expect(replyMail.text).toContain(`#comment-${reply.id}`);
    });

    it('notifies the parent about an admin reply without an owner email', async () => {
      const parent = parentOf();
      await create(makeComment({ isAdmin: true, mail: '', parentId: parent.id }), { parent });
      expect(recipients()).toEqual(['Bob@Example.com']);
    });

    it('skips replies to oneself, compared case-insensitively', async () => {
      const parent = parentOf();
      await create(makeComment({ mail: 'bob@example.COM', parentId: parent.id }), { parent });
      expect(recipients()).toEqual([OWNER]);
    });

    it('skips a parent written by the admin', async () => {
      const parent = parentOf({ isAdmin: true, mail: OWNER });
      await create(makeComment({ parentId: parent.id }), { parent });
      expect(recipients()).toEqual([OWNER]);
    });

    it('skips a parent without a valid address', async () => {
      await create(makeComment({ parentId: 1 }), { parent: parentOf({ mail: '' }) });
      await create(makeComment({ parentId: 1 }), { parent: parentOf({ mail: 'not an email' }) });
      expect(recipients()).toEqual([OWNER, OWNER]);
    });

    it('skips a parent that is not approved', async () => {
      await create(makeComment({ parentId: 1 }), { parent: parentOf({ status: 'spam' }) });
      await create(makeComment({ parentId: 1 }), { parent: parentOf({ status: 'pending' }) });
      expect(recipients()).toEqual([OWNER, OWNER]);
    });

    it('does not send a second email when the parent is the owner address', async () => {
      const parent = parentOf({ mail: 'OWNER@example.com' });
      await create(makeComment({ parentId: parent.id }), { parent });
      expect(recipients()).toEqual([OWNER]);
    });

    it('waits for moderation and sends once on approval', async () => {
      const parent = parentOf();
      const reply = makeComment({ status: 'pending', parentId: parent.id });
      await create(reply, { parent });
      expect(recipients()).toEqual([OWNER]);

      reply.status = 'approved';
      await approve(reply, { parent });
      expect(recipients()).toEqual([OWNER, 'Bob@Example.com']);

      // Spam, then approved again: the reply email is not repeated.
      await approve(reply, { parent });
      expect(recipients()).toEqual([OWNER, 'Bob@Example.com']);
    });

    it('respects notifyReply', async () => {
      setting.notify.notifyReply = false;
      const parent = parentOf();
      await create(makeComment({ isAdmin: true, mail: '', parentId: parent.id }), { parent });
      await approve(makeComment({ parentId: parent.id }), { parent });
      expect(provider.sent).toEqual([]);
    });
  });

  describe('SMTP', () => {
    it('sends nothing while SMTP is disabled but still posts the webhook', async () => {
      setting.notify.smtp.enabled = false;
      const parent = makeComment({ mail: 'bob@example.com' });
      await create(makeComment({ parentId: parent.id }), { parent });
      expect(provider.sent).toEqual([]);
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('uses an address object for From with the site name as fallback', async () => {
      await create(makeComment());
      expect(provider.sent[0].from).toEqual({ name: 'Test Blog', address: 'noreply@example.com' });

      setting.notify.smtp.fromName = 'Comment Bot';
      setting.notify.smtp.fromEmail = '';
      await create(makeComment());
      expect(provider.sent[1].from).toEqual({ name: 'Comment Bot', address: 'mailer@example.com' });
    });

    it('keeps header injection attempts out of From and Subject', async () => {
      siteInfo.siteName = 'Evil\r\nBcc: victim@example.com "<x>"';
      await create(makeComment());
      const [message] = provider.sent;
      expect(message.from.name).not.toMatch(/[\r\n<>"]/u);
      expect(message.subject).not.toMatch(/[\r\n]/u);
      expect(message.to).toBe(OWNER);
      expect(message.bcc).toBeUndefined();
    });

    it('renders a MIME message without injected headers', async () => {
      class StreamProvider extends CommentNotifyProvider {
        raw: string[] = [];
        protected createTransport(): CommentMailTransport {
          const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
          return {
            sendMail: async (message) => {
              const info: any = await transport.sendMail(message);
              this.raw.push(info.message.toString('utf8'));
              return info;
            },
          };
        }
      }
      const streaming = new StreamProvider(
        settingProvider as any,
        metaProvider as any,
        cacheProvider as any,
        pipelineProvider as any,
      );
      siteInfo.siteName = 'Evil\r\nBcc: victim@example.com';
      streaming.afterCreate(makeComment({ nick: 'Mallory\r\nX-Injected: 1' }), {
        target: { ...target, title: 'Title\r\nCc: victim@example.com' },
      });
      await streaming.drain();
      expect(streaming.raw).toHaveLength(1);
      const [headerBlock] = streaming.raw[0].split('\r\n\r\n');
      const headerNames = headerBlock
        .split('\r\n')
        .filter((line) => /^[A-Za-z-]+:/u.test(line))
        .map((line) => line.split(':')[0].toLowerCase());
      expect(headerNames).not.toContain('bcc');
      expect(headerNames).not.toContain('cc');
      expect(headerNames).not.toContain('x-injected');
      expect(headerNames.filter((name) => name === 'from')).toHaveLength(1);
      expect(headerBlock).toMatch(/^From: .*<noreply@example\.com>$/mu);
      expect(headerBlock).toMatch(/^To: owner@example\.com$/mu);
    });

    it('never puts the visitor IP or user agent into an email', async () => {
      const parent = makeComment({ mail: 'bob@example.com' });
      await create(makeComment({ parentId: parent.id }), { parent });
      expect(provider.sent).toHaveLength(2);
      const serialized = JSON.stringify(provider.sent);
      expect(serialized).not.toContain(VISITOR_IP);
      expect(serialized).not.toContain(VISITOR_UA);
    });

    it('builds the nodemailer transport from the stored setting', async () => {
      const createTransport = jest
        .spyOn(nodemailer, 'createTransport')
        .mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}), close: jest.fn() } as any);
      const real = new CommentNotifyProvider(
        settingProvider as any,
        metaProvider as any,
        cacheProvider as any,
        pipelineProvider as any,
      );
      real.afterCreate(makeComment(), { target });
      await real.drain();
      const timeout = COMMENT_NOTIFY_LIMITS.smtpTimeoutMs;
      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 465,
          secure: true,
          auth: { user: 'mailer@example.com', pass: 'super-secret-password' },
          connectionTimeout: timeout,
          greetingTimeout: timeout,
          socketTimeout: timeout,
          disableFileAccess: true,
          disableUrlAccess: true,
        }),
      );

      setting.notify.smtp.user = '';
      real.afterCreate(makeComment(), { target });
      await real.drain();
      expect(createTransport.mock.calls[1][0]).not.toHaveProperty('auth');
      createTransport.mockRestore();
    });
  });

  describe('limits', () => {
    it('caps emails per recipient per day', async () => {
      const max = COMMENT_NOTIFY_LIMITS.perRecipientDay.max;
      for (let i = 0; i < max + 3; i += 1) {
        await create(makeComment());
      }
      expect(provider.sent).toHaveLength(max);
      const keys = [...counters.keys()].filter((key) => key.startsWith('comment:notify:rcpt:'));
      expect(keys).toHaveLength(1);
      // The key is a hash, never the address itself.
      expect(keys[0]).not.toContain('example.com');
      expect(keys[0]).toMatch(/^comment:notify:rcpt:[a-f0-9]{64}$/u);
    });

    it('shares the per-recipient counter across letter case', async () => {
      await create(makeComment());
      const key = [...counters.keys()].find((item) => item.startsWith('comment:notify:rcpt:'));
      counters.set(key, COMMENT_NOTIFY_LIMITS.perRecipientDay.max);
      setting.notify.ownerEmail = 'OWNER@EXAMPLE.COM';
      await create(makeComment());
      expect(provider.sent).toHaveLength(1);
    });

    it('caps emails for the whole site per day', async () => {
      counters.set('comment:notify:global', COMMENT_NOTIFY_LIMITS.globalDay.max);
      await create(makeComment());
      expect(provider.sent).toEqual([]);
      expect(cacheProvider.incrementWithTtl).toHaveBeenCalledWith(
        'comment:notify:global',
        COMMENT_NOTIFY_LIMITS.globalDay.windowSeconds,
      );
    });
  });

  describe('failures', () => {
    it('swallows SMTP, webhook and pipeline failures independently', async () => {
      provider.sendImpl = async () => {
        throw Object.assign(new Error('535 user mailer@example.com rejected'), { code: 'EAUTH' });
      };
      post.mockRejectedValue(new Error('connect ECONNREFUSED'));
      pipelineProvider.dispatchEvent.mockRejectedValue(new Error('pipeline crashed'));
      const parent = makeComment({ mail: 'bob@example.com' });
      await create(makeComment({ parentId: parent.id }), { parent });
      // Both emails were attempted although the first one failed.
      expect(provider.sent).toHaveLength(2);
      expect(post).toHaveBeenCalledTimes(1);
      expect(pipelineProvider.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('falls back to the default site name when site info cannot be loaded', async () => {
      metaProvider.getSiteInfo.mockRejectedValue(new Error('meta unavailable'));
      await create(makeComment());
      expect(provider.sent[0].from.name).toBe('VanBlog');
    });
  });

  describe('webhook and pipeline', () => {
    it('posts a JSON payload without personal data', async () => {
      const comment = makeComment({ parentId: 7, rootId: 5 });
      await create(comment, { parent: makeComment({ id: 7 }) });
      expect(post).toHaveBeenCalledTimes(1);
      const [url, payload, options] = post.mock.calls[0];
      expect(url).toBe('https://hooks.example.com/comment');
      expect(payload).toEqual({
        event: 'comment.created',
        site: { name: 'Test Blog', url: 'https://blog.example.com' },
        target: {
          key: 'post:12',
          type: 'post',
          id: '12',
          title: 'Hello <World>',
          url: '/post/hello-world',
        },
        comment: {
          id: comment.id,
          parentId: 7,
          rootId: 5,
          nick: 'Alice',
          link: 'https://alice.example.com',
          isAdmin: false,
          status: 'approved',
          excerpt: comment.content,
          createdAt: '2026-11-17T10:00:00.000Z',
        },
      });
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('alice@example.com');
      expect(serialized).not.toContain(VISITOR_IP);
      expect(serialized).not.toContain(VISITOR_UA);
      expect(options).toEqual(
        expect.objectContaining({
          timeout: COMMENT_NOTIFY_LIMITS.webhookTimeoutMs,
          maxRedirects: 0,
          headers: expect.objectContaining({ 'User-Agent': COMMENT_WEBHOOK_USER_AGENT }),
        }),
      );
    });

    it('truncates long content to the excerpt length', async () => {
      await create(makeComment({ content: 'x'.repeat(COMMENT_NOTIFY_LIMITS.excerptLength + 50) }));
      const excerpt: string = post.mock.calls[0][1].comment.excerpt;
      expect(Array.from(excerpt)).toHaveLength(COMMENT_NOTIFY_LIMITS.excerptLength + 1);
      expect(excerpt.endsWith('…')).toBe(true);
    });

    it('skips an empty or invalid webhook URL', async () => {
      setting.notify.webhook = '';
      await create(makeComment());
      setting.notify.webhook = 'ftp://hooks.example.com';
      await create(makeComment());
      expect(post).not.toHaveBeenCalled();
    });

    it('dispatches the pipeline events with the same payload', async () => {
      const comment = makeComment();
      await create(comment);
      await approve(comment);
      expect(pipelineProvider.dispatchEvent).toHaveBeenNthCalledWith(
        1,
        'afterCommentCreate',
        expect.objectContaining({ event: 'comment.created' }),
      );
      expect(pipelineProvider.dispatchEvent).toHaveBeenNthCalledWith(
        2,
        'afterCommentApprove',
        expect.objectContaining({ event: 'comment.approved' }),
      );
      expect(post.mock.calls[1][1].event).toBe('comment.approved');
      expect(JSON.stringify(pipelineProvider.dispatchEvent.mock.calls)).not.toContain(
        'alice@example.com',
      );
    });

    it('does not email the owner when a comment is approved', async () => {
      await approve(makeComment());
      expect(provider.sent).toEqual([]);
    });
  });

  describe('sendTestMail', () => {
    const codeOf = async (promise: Promise<unknown>) => {
      try {
        await promise;
      } catch (error) {
        return (error as HttpException).getResponse() as any;
      }
      throw new Error('expected a rejection');
    };

    it('sends a test email even while notifications are disabled', async () => {
      setting.notify.smtp.enabled = false;
      await expect(provider.sendTestMail('admin@example.com')).resolves.toBeUndefined();
      expect(recipients()).toEqual(['admin@example.com']);
      expect(provider.sent[0].subject).toContain('测试');
    });

    it.each([undefined, '', 'nope', 'a@b', 42, 'x@example.com\r\nBcc: y@example.com'])(
      'rejects the invalid recipient %p',
      async (to) => {
        const body = await codeOf(provider.sendTestMail(to));
        expect(body.code).toBe('COMMENT_INVALID_INPUT');
        expect(provider.sent).toEqual([]);
      },
    );

    it('reports an unconfigured SMTP server', async () => {
      setting.notify.smtp.host = '';
      const body = await codeOf(provider.sendTestMail('admin@example.com'));
      expect(body).toEqual(
        expect.objectContaining({ statusCode: 400, code: 'COMMENT_NOTIFY_FAILED' }),
      );
    });

    it('reports failures without echoing credentials or server text', async () => {
      provider.sendImpl = async () => {
        throw Object.assign(
          new Error('Invalid login: 535 mailer@example.com super-secret-password'),
          { code: 'EAUTH', responseCode: 535 },
        );
      };
      const body = await codeOf(provider.sendTestMail('admin@example.com'));
      expect(body.statusCode).toBe(400);
      expect(body.code).toBe('COMMENT_NOTIFY_FAILED');
      expect(body.message).toBe(
        'SMTP authentication failed, check the username and password (SMTP 535)',
      );
      expect(JSON.stringify(body)).not.toContain('super-secret-password');
      expect(JSON.stringify(body)).not.toContain('mailer@example.com');
    });

    it('limits test emails per hour', async () => {
      for (let i = 0; i < COMMENT_NOTIFY_TEST_LIMIT.max; i += 1) {
        await provider.sendTestMail('admin@example.com');
      }
      const body = await codeOf(provider.sendTestMail('admin@example.com'));
      expect(body.statusCode).toBe(429);
      expect(body.code).toBe('COMMENT_RATE_LIMITED');
      expect(provider.sent).toHaveLength(COMMENT_NOTIFY_TEST_LIMIT.max);
    });

    it('does not count test emails against the notification limits', async () => {
      await provider.sendTestMail('admin@example.com');
      expect([...counters.keys()]).toEqual(['comment:notify:test']);
    });
  });

  describe('describeSmtpError', () => {
    it.each([
      [
        { code: 'ECONNECTION' },
        'Could not connect to the SMTP server, check the host, port and SSL setting',
      ],
      [{ code: 'ETIMEDOUT' }, 'The SMTP server did not respond in time'],
      [{ code: 'EDNS' }, 'The SMTP host name could not be resolved'],
      [
        { code: 'ETLS' },
        'TLS negotiation with the SMTP server failed, check the port and SSL setting',
      ],
      [
        { code: 'EENVELOPE', responseCode: 550 },
        'The SMTP server rejected the sender or recipient address (SMTP 550)',
      ],
      [{ message: 'anything at all' }, 'Sending the email failed'],
      [null, 'Sending the email failed'],
    ])('maps %p', (error, message) => {
      expect(describeSmtpError(error)).toBe(message);
    });
  });
});
