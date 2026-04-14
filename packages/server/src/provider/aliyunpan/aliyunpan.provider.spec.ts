import * as fs from 'fs';
import { EventEmitter } from 'events';
import { AliyunpanProvider } from './aliyunpan.provider';

jest.mock('fs');

const mockSpawn = jest.fn();

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: (...args: any[]) => mockSpawn(...args),
  };
});

function createSpawnProcess({
  code = 0,
  stdout = '',
  stderr = '',
}: {
  code?: number;
  stdout?: string;
  stderr?: string;
}) {
  const process = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
    stdin: {
      destroyed: boolean;
      write: jest.Mock;
    };
  };
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  process.kill = jest.fn();
  process.stdin = {
    destroyed: false,
    write: jest.fn(),
  };

  queueMicrotask(() => {
    if (stdout) {
      process.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      process.stderr.emit('data', Buffer.from(stderr));
    }
    process.emit('close', code);
  });

  return process;
}

describe('AliyunpanProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  it('uses argument arrays for sync uploads so backup paths are not executed by a shell', async () => {
    mockSpawn.mockReturnValue(
      createSpawnProcess({
        stdout: '上传结束: ok',
      }),
    );
    const provider = new AliyunpanProvider();

    const result = await provider.executeSync('/tmp/a";touch /tmp/pwn;"', '/backup/target');

    expect(result.success).toBe(true);
    expect(mockSpawn).toHaveBeenCalledWith(
      'aliyunpan',
      ['upload', '/tmp/a";touch /tmp/pwn;"', '/backup/target', '--skip'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
  });

  it('rejects empty sync paths before invoking the aliyunpan command', async () => {
    const provider = new AliyunpanProvider();

    await expect(provider.executeSync('', '/backup/target')).resolves.toEqual({
      success: false,
      message: '同步路径不能为空',
    });
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('redacts one-time aliyunpan login urls from server logs', async () => {
    const loginUrl = 'https://openapi.alipan.com/oauth/authorize?code=secret-login-token';
    const process = createSpawnProcess({ stdout: '' });
    mockSpawn.mockReturnValue(process);
    const provider = new AliyunpanProvider();
    const logSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation();

    const promise = provider.generateLoginUrl();
    process.stdout.emit('data', Buffer.from(`请在浏览器打开以下链接完成登录：\n${loginUrl}\n`));

    await expect(promise).resolves.toEqual({ loginUrl });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED_LOGIN_URL]'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining(loginUrl));
  });
});
