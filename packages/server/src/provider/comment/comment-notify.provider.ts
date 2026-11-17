import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { CacheProvider } from 'src/provider/cache/cache.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { PipelineProvider } from 'src/provider/pipeline/pipeline.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import {
  COMMENT_NOTIFY_LIMITS,
  COMMENT_PIPELINE_EVENTS,
  CommentHookContext,
  CommentLifecycleHooks,
  CommentRecord,
  CommentSetting,
  CommentSmtpSetting,
} from 'src/types/comment.dto';
import { isValidCommentEmail, isValidCommentWebhook } from 'src/utils/commentSetting';
import { commentError } from './comment-request.service';
import {
  CommentMailContent,
  CommentNotifySite,
  CommentWebhookPayload,
  DEFAULT_SITE_NAME,
  buildOwnerMail,
  buildReplyMail,
  buildTestMail,
  buildWebhookPayload,
  cleanLine,
  normalizeBaseUrl,
} from './comment-notify.templates';

/** Test emails are an admin action, limited separately from notifications. */
export const COMMENT_NOTIFY_TEST_LIMIT = { max: 10, windowSeconds: 3_600 } as const;

/** A comment triggers at most one reply email, even if it is approved twice. */
const REPLY_DEDUPE_TTL_SECONDS = 30 * 86_400;

/** Hard ceiling for one SMTP conversation on top of the per-phase timeouts. */
const SMTP_TOTAL_TIMEOUT_MS = 3 * COMMENT_NOTIFY_LIMITS.smtpTimeoutMs;

/** Webhook responses are ignored; never buffer a large one. */
const WEBHOOK_MAX_RESPONSE_BYTES = 64 * 1024;

export const COMMENT_WEBHOOK_USER_AGENT = 'VanBlog-Comment-Webhook';

const FROM_NAME_MAX_LENGTH = 64;

interface NotifyEnvironment {
  setting: CommentSetting;
  site: CommentNotifySite;
}

/** The part of a nodemailer transport this provider uses. */
export interface CommentMailTransport {
  sendMail(message: Record<string, unknown>): Promise<unknown>;
  close?(): void;
}

class SmtpError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const errorText = (error: unknown) =>
  cleanLine((error as any)?.code || (error as Error)?.message || error, 200);

const lowerMail = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

/**
 * Maps nodemailer failures to fixed English messages. Server responses are
 * never echoed because some SMTP servers include the login name in them.
 */
export function describeSmtpError(error: unknown): string {
  const code = String((error as any)?.code || '').toUpperCase();
  const responseCode = Number((error as any)?.responseCode);
  let message: string;
  switch (code) {
    case 'EAUTH':
    case 'ENOAUTH':
      message = 'SMTP authentication failed, check the username and password';
      break;
    case 'ECONNECTION':
    case 'ESOCKET':
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      message = 'Could not connect to the SMTP server, check the host, port and SSL setting';
      break;
    case 'ETIMEDOUT':
    case 'ETIMEOUT':
      message = 'The SMTP server did not respond in time';
      break;
    case 'EDNS':
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      message = 'The SMTP host name could not be resolved';
      break;
    case 'ETLS':
      message = 'TLS negotiation with the SMTP server failed, check the port and SSL setting';
      break;
    case 'EENVELOPE':
      message = 'The SMTP server rejected the sender or recipient address';
      break;
    case 'EMESSAGE':
    case 'EPROTOCOL':
      message = 'The SMTP server rejected the message';
      break;
    case 'ECONFIG':
      message = 'SMTP is not fully configured';
      break;
    default:
      message = 'Sending the email failed';
  }
  if (Number.isInteger(responseCode) && responseCode >= 200 && responseCode <= 599) {
    message += ` (SMTP ${responseCode})`;
  }
  return message;
}

/** True when the stored SMTP setting can be used to send mail at all. */
export function isSmtpConfigured(smtp: CommentSmtpSetting): boolean {
  return Boolean(
    smtp?.host && (isValidCommentEmail(smtp.fromEmail) || isValidCommentEmail(smtp.user)),
  );
}

/**
 * Sends comment notifications: owner and reply emails, the webhook and the
 * pipeline events. Bound to COMMENT_LIFECYCLE_HOOKS; every hook returns at
 * once and does its work in a background promise that never rejects.
 */
@Injectable()
export class CommentNotifyProvider implements CommentLifecycleHooks {
  private readonly logger = new Logger(CommentNotifyProvider.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly settingProvider: SettingProvider,
    private readonly metaProvider: MetaProvider,
    private readonly cacheProvider: CacheProvider,
    private readonly pipelineProvider: PipelineProvider,
  ) {}

  afterCreate(comment: CommentRecord, context: CommentHookContext): void {
    this.schedule(`created comment ${comment?.id}`, () => this.handleCreate(comment, context));
  }

  afterApprove(comment: CommentRecord, context: CommentHookContext): void {
    this.schedule(`approved comment ${comment?.id}`, () => this.handleApprove(comment, context));
  }

  /** Resolves once every background notification started so far has settled. */
  async drain(): Promise<void> {
    while (this.pending.size) {
      await Promise.allSettled([...this.pending]);
    }
  }

  /**
   * Sends a test email with the stored SMTP setting and reports failures as a
   * coded 400. The `enabled` switch is ignored so the admin can test first.
   */
  async sendTestMail(to: unknown): Promise<void> {
    if (!isValidCommentEmail(to)) {
      throw commentError(400, 'COMMENT_INVALID_INPUT', 'A valid recipient email is required');
    }
    const count = await this.cacheProvider.incrementWithTtl(
      'comment:notify:test',
      COMMENT_NOTIFY_TEST_LIMIT.windowSeconds,
    );
    if (count > COMMENT_NOTIFY_TEST_LIMIT.max) {
      throw commentError(429, 'COMMENT_RATE_LIMITED', 'Too many test emails, try again later', {
        retryAfterSeconds: COMMENT_NOTIFY_TEST_LIMIT.windowSeconds,
      });
    }
    const env = await this.loadEnvironment();
    if (!isSmtpConfigured(env.setting.notify.smtp)) {
      throw commentError(400, 'COMMENT_NOTIFY_FAILED', 'SMTP is not fully configured');
    }
    try {
      await this.sendMail(env, to, buildTestMail(env.site));
    } catch (error) {
      this.logger.warn(`Comment test email failed: ${errorText(error)}`);
      throw commentError(400, 'COMMENT_NOTIFY_FAILED', describeSmtpError(error));
    }
  }

  private schedule(label: string, task: () => Promise<void>): void {
    let promise: Promise<void>;
    try {
      promise = new Promise<void>((resolve) => setImmediate(resolve))
        .then(task)
        .catch((error) => {
          this.logger.error(`Comment notification failed for ${label}: ${errorText(error)}`);
        })
        .finally(() => {
          this.pending.delete(promise);
        });
      this.pending.add(promise);
    } catch (error) {
      this.logger.error(`Comment notification could not start for ${label}: ${errorText(error)}`);
    }
  }

  private async handleCreate(comment: CommentRecord, context: CommentHookContext) {
    const env = await this.loadEnvironment();
    const payload = buildWebhookPayload('comment.created', env.site, comment, context?.target);
    const ownerRecipient = this.ownerRecipient(env, comment);
    await Promise.all([
      this.step(comment, 'pipeline event', () =>
        this.pipelineProvider.dispatchEvent(COMMENT_PIPELINE_EVENTS.afterCreate, payload),
      ),
      this.step(comment, 'webhook', () => this.postWebhook(env, payload)),
      this.step(comment, 'owner email', async () => {
        if (!ownerRecipient) return;
        await this.deliver(
          env,
          ownerRecipient,
          buildOwnerMail(env.site, context.target, comment),
          `owner email for comment ${comment.id}`,
        );
      }),
      // The owner notice already covers a reply to an address the owner reads.
      this.step(comment, 'reply email', () =>
        this.notifyReply(env, comment, context, ownerRecipient),
      ),
    ]);
  }

  private async handleApprove(comment: CommentRecord, context: CommentHookContext) {
    const env = await this.loadEnvironment();
    const payload = buildWebhookPayload('comment.approved', env.site, comment, context?.target);
    await Promise.all([
      this.step(comment, 'pipeline event', () =>
        this.pipelineProvider.dispatchEvent(COMMENT_PIPELINE_EVENTS.afterApprove, payload),
      ),
      this.step(comment, 'webhook', () => this.postWebhook(env, payload)),
      this.step(comment, 'reply email', () => this.notifyReply(env, comment, context, '')),
    ]);
  }

  private async step(comment: CommentRecord, name: string, run: () => Promise<unknown>) {
    try {
      await run();
    } catch (error) {
      this.logger.warn(`Comment ${comment?.id}: ${name} failed: ${errorText(error)}`);
    }
  }

  private async loadEnvironment(): Promise<NotifyEnvironment> {
    const [setting, siteInfo] = await Promise.all([
      this.settingProvider.getCommentSetting(),
      Promise.resolve()
        .then(() => this.metaProvider.getSiteInfo())
        .catch(() => null),
    ]);
    const info: any = siteInfo || {};
    return {
      setting,
      site: {
        name: cleanLine(info.siteName, FROM_NAME_MAX_LENGTH) || DEFAULT_SITE_NAME,
        baseUrl: normalizeBaseUrl(info.baseUrl),
      },
    };
  }

  private smtpReady(env: NotifyEnvironment): boolean {
    const smtp = env.setting.notify.smtp;
    return Boolean(smtp.enabled) && isSmtpConfigured(smtp);
  }

  /** Lowercased owner address when this comment warrants an owner email, else ''. */
  private ownerRecipient(env: NotifyEnvironment, comment: CommentRecord): string {
    const notify = env.setting.notify;
    if (comment?.isAdmin || !notify.notifyOwner || !this.smtpReady(env)) return '';
    return isValidCommentEmail(notify.ownerEmail) ? lowerMail(notify.ownerEmail) : '';
  }

  private async notifyReply(
    env: NotifyEnvironment,
    comment: CommentRecord,
    context: CommentHookContext,
    skipAddress: string,
  ) {
    const parent = context?.parent;
    if (comment?.status !== 'approved' || !parent) return;
    if (!env.setting.notify.notifyReply || !this.smtpReady(env)) return;
    // Spam or pending parents may carry an address their author does not own.
    if (parent.status !== 'approved' || parent.isAdmin) return;
    if (!isValidCommentEmail(parent.mail)) return;
    const recipient = lowerMail(parent.mail);
    if (recipient === lowerMail(comment.mail) || recipient === skipAddress) return;

    const fresh = await this.cacheProvider.setIfAbsent(
      `comment:notify:reply:${comment.id}`,
      1,
      REPLY_DEDUPE_TTL_SECONDS,
    );
    if (!fresh) return;
    await this.deliver(
      env,
      parent.mail.trim(),
      buildReplyMail(env.site, context.target, comment, parent),
      `reply email for comment ${comment.id}`,
    );
  }

  /** Applies the daily limits, then sends. Never logs the recipient address. */
  private async deliver(
    env: NotifyEnvironment,
    to: string,
    content: CommentMailContent,
    label: string,
  ) {
    const digest = createHash('sha256').update(lowerMail(to)).digest('hex');
    const { perRecipientDay, globalDay } = COMMENT_NOTIFY_LIMITS;
    const perRecipient = await this.cacheProvider.incrementWithTtl(
      `comment:notify:rcpt:${digest}`,
      perRecipientDay.windowSeconds,
    );
    if (perRecipient > perRecipientDay.max) {
      this.logger.warn(`Skipped ${label}: the recipient reached the daily email limit`);
      return;
    }
    const global = await this.cacheProvider.incrementWithTtl(
      'comment:notify:global',
      globalDay.windowSeconds,
    );
    if (global > globalDay.max) {
      this.logger.warn(`Skipped ${label}: the site reached the daily email limit`);
      return;
    }
    await this.sendMail(env, to, content);
    this.logger.log(`Sent ${label}`);
  }

  private async sendMail(env: NotifyEnvironment, to: string, content: CommentMailContent) {
    const smtp = env.setting.notify.smtp;
    const address = isValidCommentEmail(smtp.fromEmail) ? smtp.fromEmail : smtp.user;
    if (!isValidCommentEmail(address)) {
      throw new SmtpError('No valid sender address', 'ECONFIG');
    }
    // An address object lets nodemailer encode the display name; nothing user
    // controlled is ever concatenated into a header.
    const from = {
      name: cleanLine(smtp.fromName || env.site.name, FROM_NAME_MAX_LENGTH).replace(/[<>"]/gu, ''),
      address,
    };
    const transport = this.createTransport(smtp);
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        transport.sendMail({
          from,
          to,
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new SmtpError('SMTP conversation timed out', 'ETIMEDOUT')),
            SMTP_TOTAL_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
      try {
        transport.close?.();
      } catch {
        // Closing an already failed transport is best effort.
      }
    }
  }

  /** Separate so tests can capture the outgoing messages. */
  protected createTransport(smtp: CommentSmtpSetting): CommentMailTransport {
    const timeout = COMMENT_NOTIFY_LIMITS.smtpTimeoutMs;
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout,
      dnsTimeout: timeout,
      // Messages never reference files or URLs; refuse them outright.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  private async postWebhook(env: NotifyEnvironment, payload: CommentWebhookPayload) {
    const url = env.setting.notify.webhook;
    if (!url || !isValidCommentWebhook(url)) return;
    const response = await axios.post(url, payload, {
      timeout: COMMENT_NOTIFY_LIMITS.webhookTimeoutMs,
      maxRedirects: 0,
      maxContentLength: WEBHOOK_MAX_RESPONSE_BYTES,
      responseType: 'text',
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': COMMENT_WEBHOOK_USER_AGENT,
      },
    });
    if (response.status < 200 || response.status >= 300) {
      this.logger.warn(
        `Comment ${payload.comment.id}: webhook answered HTTP ${Number(response.status)}`,
      );
    }
  }
}
