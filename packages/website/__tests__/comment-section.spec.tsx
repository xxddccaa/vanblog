// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicComment, PublicCommentPage } from '../api/comments';
import { COMMENT_PROFILE_STORAGE_KEY } from '../components/Comments/utils';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const comment = (overrides: Partial<PublicComment>): PublicComment => ({
  id: 1,
  target: 'post:7',
  parentId: null,
  rootId: null,
  replyToNick: null,
  nick: 'Alice',
  link: '',
  isAdmin: false,
  pinned: false,
  content: 'Hello',
  likes: 0,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  ...overrides,
});

const page = (overrides: Partial<PublicCommentPage> = {}): PublicCommentPage => ({
  items: [],
  total: 0,
  count: 0,
  page: 1,
  pageSize: 10,
  sort: 'latest',
  config: { pageSize: 10, maxLength: 200, allowVisitorImage: false, requireMail: false },
  ...overrides,
});

const fixture = () =>
  page({
    total: 2,
    count: 5,
    items: [
      comment({
        id: 1,
        nick: 'Alice',
        link: 'https://alice.example',
        pinned: true,
        likes: 2,
        location: '浙江',
        browser: 'Chrome 131',
        os: 'Windows 10',
        replies: [
          comment({
            id: 2,
            parentId: 1,
            rootId: 1,
            replyToNick: 'Alice',
            nick: 'Owner',
            isAdmin: true,
            content: 'Thanks',
          }),
          comment({
            id: 3,
            parentId: 2,
            rootId: 1,
            replyToNick: 'Owner',
            nick: '',
            content: 'Nested reply',
          }),
        ],
      }),
      comment({
        id: 4,
        deleted: true,
        nick: '',
        content: '',
        replies: [comment({ id: 5, parentId: 4, rootId: 4, nick: 'Carol', content: 'Still here' })],
      }),
    ],
  });

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data: unknown) => json(200, { statusCode: 200, data });

let container: HTMLDivElement;
let root: Root;
let handlers: Record<string, Handler>;
let calls: Array<{ url: URL; init: RequestInit }>;

const routeKey = (url: URL, init: RequestInit) =>
  `${(init.method || 'GET').toUpperCase()} ${url.pathname}`;

const installFetch = () => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      calls.push({ url, init });
      const handler = handlers[routeKey(url, init)];
      if (!handler) {
        return json(404, { statusCode: 404, message: 'missing route' });
      }
      return handler(url, init);
    }),
  );
};

const flush = async (rounds = 4) => {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const mount = async (target = 'post:7') => {
  const { default: CommentSection } = await import('../components/Comments/core');
  await act(async () => {
    root.render(<CommentSection target={target as any} />);
  });
  await flush();
};

const $ = <T extends Element = HTMLElement>(selector: string) =>
  container.querySelector(selector) as T | null;
const $$ = <T extends Element = HTMLElement>(selector: string) =>
  Array.from(container.querySelectorAll(selector)) as T[];
const byText = (selector: string, text: string) =>
  $$<HTMLElement>(selector).find((element) => element.textContent?.trim() === text) || null;
const mainForm = () => $<HTMLFormElement>('form[aria-label="发表评论"]')!;
const field = <T extends HTMLElement>(form: HTMLElement, name: string) =>
  form.querySelector(`[name="${name}"]`) as T;

const setValue = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const click = async (element: HTMLElement | null) => {
  expect(element).toBeTruthy();
  await act(async () => {
    element!.click();
  });
};

const submit = async (form: HTMLFormElement) => {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await flush();
};

const postedBodies = () =>
  calls
    .filter((call) => call.init.method === 'POST' && call.url.pathname === '/api/public/comment')
    .map((call) => JSON.parse(String(call.init.body)));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/post/7');
  handlers = {
    'GET /api/public/comment': () => ok(fixture()),
    'GET /api/public/comment/identity': () => ok({ admin: false }),
    'GET /api/public/comment/liked': () => ok({ ids: [2] }),
  };
  installFetch();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('comment section rendering', () => {
  it('loads the thread for the target and shows the visible count', async () => {
    await mount();

    const listCall = calls.find((call) => call.url.pathname === '/api/public/comment');
    expect(listCall?.url.searchParams.get('target')).toBe('post:7');
    expect(listCall?.url.searchParams.get('sort')).toBe('latest');
    expect($('h2')?.textContent).toBe('评论5');
  });

  it('renders badges, placeholders and two-level reply labels', async () => {
    await mount();

    const first = $('#comment-1')!;
    expect(first.textContent).toContain('置顶');
    const nickLink = first.querySelector('a[href="https://alice.example/"]') as HTMLAnchorElement;
    expect(nickLink.textContent).toBe('Alice');
    expect(nickLink.getAttribute('rel')).toBe('nofollow ugc noopener noreferrer');
    expect(nickLink.getAttribute('target')).toBe('_blank');
    expect(first.textContent).toContain('浙江');
    expect(first.textContent).toContain('Chrome 131');
    expect(first.textContent).toContain('Windows 10');

    const ownerReply = $('#comment-2')!;
    expect(ownerReply.textContent).toContain('博主');
    // A direct reply to the root needs no "reply to" label.
    expect(ownerReply.textContent).not.toContain('回复 @');
    expect(ownerReply.textContent).not.toContain('浙江');

    const nested = $('#comment-3')!;
    expect(nested.textContent).toContain('匿名');
    expect(nested.textContent).toContain('回复 @Owner');

    const deleted = $('#comment-4')!;
    expect(deleted.textContent).toContain('该评论已删除');
    // The placeholder itself has no actions; only its visible replies do.
    const buttons = Array.from(deleted.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.closest('#comment-5'))).toBe(true);
    expect($('#comment-5')?.textContent).toContain('Still here');
  });

  it('renders comment Markdown through the strict renderer', async () => {
    handlers['GET /api/public/comment'] = () =>
      ok(
        page({
          total: 1,
          count: 1,
          items: [
            comment({
              id: 8,
              content: '**bold** [x](javascript:alert(1)) <img src=x onerror=alert(1)>',
            }),
          ],
        }),
      );
    await mount();

    const body = $('#comment-8 .vb-comment-markdown')!;
    expect(body.innerHTML).toContain('<strong>bold</strong>');
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('a')?.hasAttribute('href')).toBe(false);
  });

  it('switches sort order and paginates root comments', async () => {
    handlers['GET /api/public/comment'] = (url) =>
      ok(
        page({
          total: 25,
          count: 30,
          page: Number(url.searchParams.get('page')),
          items: [comment({ id: 20 + Number(url.searchParams.get('page')) })],
        }),
      );
    await mount();

    expect($('nav[aria-label="评论分页"]')?.textContent).toContain('1 / 3');
    await click(byText('nav[aria-label="评论分页"] button', '下一页'));
    await flush();
    expect(
      calls
        .filter((call) => call.url.pathname === '/api/public/comment')
        .pop()
        ?.url.searchParams.get('page'),
    ).toBe('2');
    expect($('#comment-22')).toBeTruthy();

    const hot = byText('[aria-label="评论排序"] button', '最热')!;
    await click(hot);
    await flush();
    const last = calls.filter((call) => call.url.pathname === '/api/public/comment').pop()!;
    expect(last.url.searchParams.get('sort')).toBe('hot');
    expect(last.url.searchParams.get('page')).toBe('1');
    expect(hot.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders nothing when comments are unavailable for the target', async () => {
    handlers['GET /api/public/comment'] = () =>
      json(404, { statusCode: 404, message: 'x', code: 'COMMENT_TARGET_UNAVAILABLE' });
    await mount();
    expect(container.innerHTML).toBe('');
  });

  it('offers a retry when loading fails', async () => {
    let attempts = 0;
    handlers['GET /api/public/comment'] = () => {
      attempts += 1;
      return attempts === 1 ? json(500, { statusCode: 500, message: 'x' }) : ok(fixture());
    };
    await mount();
    expect(container.textContent).toContain('评论加载失败：服务器开小差了，请稍后再试');
    await click(byText('button', '重试'));
    await flush();
    expect($('#comment-1')).toBeTruthy();
  });
});

describe('comment likes', () => {
  it('starts from the liked ids of this visitor', async () => {
    await mount();
    const likedCall = calls.find((call) => call.url.pathname === '/api/public/comment/liked');
    expect(likedCall?.url.searchParams.get('ids')).toBe('1,2,3,4,5');
    expect($('#comment-2 button[aria-pressed]')?.getAttribute('aria-pressed')).toBe('true');
    expect($('#comment-1 button[aria-pressed]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles optimistically and then applies the server result', async () => {
    let resolveLike: (response: Response) => void = () => undefined;
    handlers['POST /api/public/comment/1/like'] = () =>
      new Promise<Response>((resolve) => {
        resolveLike = resolve;
      });
    await mount();

    const button = $<HTMLButtonElement>('#comment-1 button[aria-pressed]')!;
    await click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('3');
    expect(button.disabled).toBe(true);

    await act(async () => {
      resolveLike(ok({ liked: true, likes: 9 }));
    });
    await flush();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('9');
    expect(button.disabled).toBe(false);
    const likeCall = calls.find((call) => call.url.pathname === '/api/public/comment/1/like')!;
    expect(likeCall.init.body).toBe('{}');
  });

  it('rolls back and explains a failed like', async () => {
    handlers['POST /api/public/comment/1/like'] = () =>
      json(429, {
        statusCode: 429,
        message: 'x',
        code: 'COMMENT_RATE_LIMITED',
        retryAfterSeconds: 30,
      });
    await mount();

    const button = $<HTMLButtonElement>('#comment-1 button[aria-pressed]')!;
    await click(button);
    await flush();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.textContent).toContain('2');
    expect($('[role="alert"]')?.textContent).toBe('操作太频繁，请 30 秒后再试');
  });
});

describe('comment form', () => {
  it('posts with an empty honeypot and inserts approved comments locally', async () => {
    handlers['POST /api/public/comment'] = (_url, init) => {
      const body = JSON.parse(String(init.body));
      return ok({
        status: 'approved',
        comment: comment({
          id: 50,
          nick: body.nick,
          content: body.content,
          createdAt: new Date().toISOString(),
        }),
      });
    };
    await mount();

    const form = mainForm();
    const honeypot = field<HTMLInputElement>(form, 'website');
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.getAttribute('autocomplete')).toBe('off');
    expect(honeypot.closest('[aria-hidden="true"]')).toBeTruthy();

    await setValue(field(form, 'nick'), ' Dave ');
    await setValue(field(form, 'mail'), 'dave@example.com');
    await setValue(field(form, 'content'), '\nFirst!  ');
    await submit(form);

    expect(postedBodies()).toEqual([
      {
        target: 'post:7',
        parentId: null,
        content: 'First!',
        website: '',
        nick: 'Dave',
        mail: 'dave@example.com',
        link: '',
      },
    ]);
    const posted = calls.find((call) => call.init.method === 'POST')!;
    expect((posted.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
    expect(posted.init.credentials).toBe('same-origin');

    expect($('#comment-50')?.textContent).toContain('First!');
    expect($('#comment-50')?.textContent).not.toContain('待审核');
    expect($('[role="status"]')?.textContent).toBe('评论发表成功');
    expect($('h2')?.textContent).toBe('评论6');
    expect(field<HTMLTextAreaElement>(form, 'content').value).toBe('');
  });

  it('shows pending comments only to their author with a moderation tag', async () => {
    handlers['POST /api/public/comment'] = () =>
      ok({
        status: 'pending',
        comment: comment({ id: 51, content: 'Wait for me', createdAt: new Date().toISOString() }),
      });
    await mount();

    await setValue(field(mainForm(), 'content'), 'Wait for me');
    await submit(mainForm());

    const pending = $('#comment-51')!;
    expect(pending.textContent).toContain('待审核');
    expect(pending.querySelector('button[aria-pressed]')).toBeNull();
    expect($('[role="status"]')?.textContent).toBe('评论已提交，审核后显示');
    expect($('h2')?.textContent).toBe('评论5');
  });

  it('requires mail when the site asks for it', async () => {
    handlers['GET /api/public/comment'] = () =>
      ok(
        page({
          config: { pageSize: 10, maxLength: 200, allowVisitorImage: false, requireMail: true },
        }),
      );
    await mount();

    const mail = field<HTMLInputElement>(mainForm(), 'mail');
    expect(mail.required).toBe(true);
    await setValue(field(mainForm(), 'content'), 'Hello');
    await submit(mainForm());

    expect(postedBodies()).toEqual([]);
    expect(mainForm().querySelector('[role="alert"]')?.textContent).toBe('请填写邮箱');
  });

  it('counts characters against the configured maximum', async () => {
    await mount();
    const form = mainForm();
    await setValue(field(form, 'content'), 'x'.repeat(201));

    const counterId = field(form, 'content').getAttribute('aria-describedby')!;
    expect(document.getElementById(counterId)?.textContent).toBe('201 / 200');
    await submit(form);
    expect(postedBodies()).toEqual([]);
    expect(form.querySelector('[role="alert"]')?.textContent).toBe('评论内容不能超过 200 字');
  });

  it('maps server errors to messages', async () => {
    handlers['POST /api/public/comment'] = () =>
      json(429, {
        statusCode: 429,
        message: 'x',
        code: 'COMMENT_RATE_LIMITED',
        retryAfterSeconds: 120,
      });
    await mount();
    await setValue(field(mainForm(), 'content'), 'Hello');
    await submit(mainForm());
    expect(mainForm().querySelector('[role="alert"]')?.textContent).toBe(
      '操作太频繁，请 2 分钟后再试',
    );
    expect(field<HTMLTextAreaElement>(mainForm(), 'content').value).toBe('Hello');
  });

  it('replaces visitor fields with the owner identity', async () => {
    handlers['GET /api/public/comment/identity'] = () => ok({ admin: true, nick: 'Blogger' });
    handlers['POST /api/public/comment'] = () =>
      ok({ status: 'approved', comment: comment({ id: 60, isAdmin: true, nick: 'Blogger' }) });
    await mount();

    const form = mainForm();
    expect(field(form, 'nick')).toBeNull();
    expect(field(form, 'mail')).toBeNull();
    expect(field(form, 'link')).toBeNull();
    expect(form.textContent).toContain('以博主身份发言：Blogger');

    await setValue(field(form, 'content'), 'Owner note');
    await submit(form);
    const [body] = postedBodies();
    expect(body).toEqual({ target: 'post:7', parentId: null, content: 'Owner note', website: '' });
  });

  it('remembers the visitor profile when asked to', async () => {
    window.localStorage.setItem(
      COMMENT_PROFILE_STORAGE_KEY,
      JSON.stringify({ nick: 'Erin', mail: 'erin@example.com', link: 'https://erin.example' }),
    );
    handlers['POST /api/public/comment'] = () =>
      ok({ status: 'approved', comment: comment({ id: 70 }) });
    await mount();

    const form = mainForm();
    expect(field<HTMLInputElement>(form, 'nick').value).toBe('Erin');
    expect(field<HTMLInputElement>(form, 'mail').value).toBe('erin@example.com');

    await setValue(field(form, 'nick'), 'Erin B');
    await setValue(field(form, 'content'), 'Hi');
    await submit(form);
    expect(JSON.parse(window.localStorage.getItem(COMMENT_PROFILE_STORAGE_KEY)!)).toEqual({
      nick: 'Erin B',
      mail: 'erin@example.com',
      link: 'https://erin.example',
    });

    const remember = byText('label', '记住我的信息')!.querySelector('input') as HTMLInputElement;
    expect(remember.checked).toBe(true);
    await click(remember);
    expect(remember.checked).toBe(false);
    expect(window.localStorage.getItem(COMMENT_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('keeps working when storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    handlers['POST /api/public/comment'] = () =>
      ok({ status: 'approved', comment: comment({ id: 71 }) });
    try {
      await mount();
      await setValue(field(mainForm(), 'content'), 'Hi');
      await submit(mainForm());
      expect($('#comment-71')).toBeTruthy();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('opens an inline reply form under the comment and sends the parent id', async () => {
    handlers['POST /api/public/comment'] = () =>
      ok({
        status: 'approved',
        comment: comment({
          id: 80,
          parentId: 3,
          rootId: 1,
          replyToNick: '',
          nick: 'Frank',
          content: 'Reply!',
        }),
      });
    await mount();

    await click($('#comment-3 button[aria-label="回复 匿名"]'));
    const replyForm = $<HTMLFormElement>('#comment-3 form')!;
    expect(replyForm.getAttribute('aria-label')).toBe('回复 匿名');
    expect(document.activeElement).toBe(field(replyForm, 'content'));

    await setValue(field(replyForm, 'content'), 'Reply!');
    await submit(replyForm);

    expect(postedBodies()[0].parentId).toBe(3);
    expect($('#comment-3 form')).toBeNull();
    const reply = $('#comment-80')!;
    expect(reply.closest('#comment-1')).toBeTruthy();
    expect(reply.textContent).toContain('回复 @匿名');
  });

  it('previews Markdown with the comment renderer and keyboard-switchable tabs', async () => {
    await mount();
    const form = mainForm();
    await setValue(field(form, 'content'), '**strong** <script>alert(1)</script>');

    const [writeTab, previewTab] = Array.from(
      form.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    expect(writeTab.getAttribute('aria-selected')).toBe('true');
    await act(async () => {
      writeTab.focus();
      writeTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(previewTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(previewTab);

    const panel = document.getElementById(previewTab.getAttribute('aria-controls')!)!;
    expect(panel.hidden).toBe(false);
    expect(panel.innerHTML).toContain('<strong>strong</strong>');
    expect(panel.innerHTML).not.toContain('<script');
  });

  it('inserts emoji from a keyboard-operable panel', async () => {
    await mount();
    const form = mainForm();
    const toggle = form.querySelector<HTMLButtonElement>('button[aria-label="插入表情"]')!;
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'));
    expect(document.activeElement).toBe(buttons[0]);
    await act(async () => {
      buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(document.activeElement).toBe(buttons[1]);
    await click(buttons[1]);
    expect(field<HTMLTextAreaElement>(form, 'content').value).toBe(buttons[1].textContent);

    await act(async () => {
      buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('hides image upload unless visitors may upload', async () => {
    await mount();
    expect(mainForm().querySelector('button[aria-label="上传图片"]')).toBeNull();
  });

  it('uploads images and inserts the returned Markdown', async () => {
    handlers['GET /api/public/comment'] = () =>
      ok(
        page({
          config: { pageSize: 10, maxLength: 200, allowVisitorImage: true, requireMail: false },
        }),
      );
    handlers['POST /api/public/comment/image'] = () =>
      ok({ url: '/static/img/comment/a.webp', markdown: '![](/static/img/comment/a.webp)' });
    await mount();

    const form = mainForm();
    expect(form.querySelector('button[aria-label="上传图片"]')).toBeTruthy();
    const input = form.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();

    const upload = calls.find((call) => call.url.pathname === '/api/public/comment/image')!;
    expect((upload.init.body as FormData).get('target')).toBe('post:7');
    expect(field<HTMLTextAreaElement>(form, 'content').value).toBe(
      '![](/static/img/comment/a.webp)',
    );
  });

  it('uploads pasted and dropped images', async () => {
    handlers['GET /api/public/comment'] = () =>
      ok(
        page({
          config: { pageSize: 10, maxLength: 200, allowVisitorImage: true, requireMail: false },
        }),
      );
    let uploads = 0;
    handlers['POST /api/public/comment/image'] = () => {
      uploads += 1;
      return ok({
        url: `/static/img/comment/${uploads}.webp`,
        markdown: `![](/static/img/comment/${uploads}.webp)`,
      });
    };
    await mount();

    const form = mainForm();
    const textarea = field<HTMLTextAreaElement>(form, 'content');
    const file = new File([new Uint8Array([1])], 'p.png', { type: 'image/png' });

    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { files: [file], types: ['Files'] } });
    await act(async () => {
      textarea.dispatchEvent(paste);
    });
    await flush();
    expect(paste.defaultPrevented).toBe(true);
    expect(textarea.value).toBe('![](/static/img/comment/1.webp)');

    const dropZone = textarea.closest('[role="tabpanel"]')!.parentElement!;
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file], types: ['Files'] } });
    await act(async () => {
      dropZone.dispatchEvent(drop);
    });
    await flush();
    expect(drop.defaultPrevented).toBe(true);
    expect(uploads).toBe(2);
    expect(textarea.value).toContain('![](/static/img/comment/2.webp)');
  });

  it('rejects unsupported image types before uploading', async () => {
    handlers['GET /api/public/comment'] = () =>
      ok(
        page({
          config: { pageSize: 10, maxLength: 200, allowVisitorImage: true, requireMail: false },
        }),
      );
    await mount();

    const input = mainForm().querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();

    expect(calls.some((call) => call.url.pathname === '/api/public/comment/image')).toBe(false);
    expect(mainForm().querySelector('[role="alert"]')?.textContent).toBe(
      '仅支持 PNG、JPEG、WebP、GIF 格式的图片',
    );
  });
});

describe('comment anchors', () => {
  it('scrolls to and highlights #comment-<id> after loading', async () => {
    const scrollIntoView = vi.fn();
    (HTMLElement.prototype as any).scrollIntoView = scrollIntoView;
    window.history.replaceState(null, '', '/post/7#comment-3');
    try {
      await mount();
      const target = $('#comment-3')!;
      expect(target.classList.contains('vb-comment-highlight')).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
      expect(scrollIntoView.mock.instances[0]).toBe(target);
    } finally {
      delete (HTMLElement.prototype as any).scrollIntoView;
    }
  });

  it('links each comment time to its own anchor', async () => {
    await mount();
    expect($('#comment-1 a[href="#comment-1"] time')).toBeTruthy();
    expect($('#comment-5 a[href="#comment-5"] time')).toBeTruthy();
  });
});
