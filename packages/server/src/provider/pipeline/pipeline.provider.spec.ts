const forkMock = jest.fn();
const spawnSyncMock = jest.fn();
const writeFileSyncMock = jest.fn();
const rmSyncMock = jest.fn();

jest.mock('child_process', () => ({
  fork: (...args: any[]) => forkMock(...args),
  spawnSync: (...args: any[]) => spawnSyncMock(...args),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
  writeFileSync: (...args: any[]) => writeFileSyncMock(...args),
  rmSync: (...args: any[]) => rmSyncMock(...args),
}));

jest.mock('src/config', () => ({
  config: {
    codeRunnerPath: '/tmp/codeRunner',
  },
}));

jest.mock('src/storage/mongoose-compat', () => ({
  InjectModel: () => () => undefined,
  Model: class {},
}));

const { PipelineProvider } = require('./pipeline.provider');

describe('PipelineProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createProvider = () =>
    new PipelineProvider(
      {
        find: jest.fn().mockResolvedValue([]),
      } as any,
      {
        runPipeline: jest.fn(),
      } as any,
      {
        isInitialized: jest.fn().mockReturnValue(true),
        listPipelines: jest.fn().mockResolvedValue([]),
        getPipelineById: jest.fn(),
      } as any,
    );

  const createChildProcessMock = () => {
    const handlers: Record<string, Function | undefined> = {};
    return {
      handlers,
      killed: false,
      send: jest.fn(),
      kill: jest.fn().mockImplementation(function (this: any) {
        this.killed = true;
      }),
      disconnect: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        handlers[event] = handler;
        return childProcessMock as any;
      }),
      removeAllListeners: jest.fn().mockReturnThis(),
    };
  };

  let childProcessMock: any;

  beforeEach(() => {
    childProcessMock = createChildProcessMock();
    forkMock.mockReturnValue(childProcessMock);
  });

  it('kills the pipeline child process after a successful response to avoid orphan runners', async () => {
    const provider = createProvider();
    jest.spyOn(provider, 'getPipelineById').mockResolvedValue({
      id: 1,
      deleted: false,
    } as any);

    const runPromise = provider.runCodeByPipelineId(1, { hello: 'world' });
    await Promise.resolve();
    childProcessMock.handlers.message?.({
      status: 'success',
      output: { ok: true },
      logs: ['done'],
    });

    await expect(runPromise).resolves.toEqual({
      status: 'success',
      output: { ok: true },
      logs: ['done'],
    });
    expect(childProcessMock.disconnect).toHaveBeenCalled();
    expect(childProcessMock.kill).toHaveBeenCalledWith('SIGINT');
    expect(forkMock).toHaveBeenCalledWith(
      '/tmp/codeRunner/1.js',
      [],
      expect.objectContaining({
        cwd: '/tmp/codeRunner',
        execArgv: expect.arrayContaining([
          '--max-old-space-size=128',
          '--permission',
          '--allow-fs-read=/tmp/codeRunner',
          '--require=/tmp/codeRunner/sandbox-preload.cjs',
        ]),
        env: expect.not.objectContaining({
          VAN_BLOG_DATABASE_URL: expect.anything(),
        }),
      }),
    );
  });

  it('times out stuck pipelines and forcefully returns an error instead of hanging forever', async () => {
    jest.useFakeTimers();
    try {
      const provider = createProvider();
      (provider as any).pipelineRunTimeoutMs = 50;
      jest.spyOn(provider, 'getPipelineById').mockResolvedValue({
        id: 2,
        deleted: false,
      } as any);

      const runPromise = provider.runCodeByPipelineId(2, {});
      await Promise.resolve();
      jest.advanceTimersByTime(60);

      await expect(runPromise).rejects.toMatchObject({
        status: 'error',
        output: expect.objectContaining({
          message: expect.stringContaining('流水线执行超时'),
        }),
      });
      expect(childProcessMock.disconnect).toHaveBeenCalled();
      expect(childProcessMock.kill).toHaveBeenCalledWith('SIGINT');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps pipeline execution disabled by default in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousFlag = process.env.VAN_BLOG_PIPELINE_EXECUTION_ENABLED;
    process.env.NODE_ENV = 'production';
    delete process.env.VAN_BLOG_PIPELINE_EXECUTION_ENABLED;
    try {
      const provider = createProvider();
      await expect(provider.runCodeByPipelineId(1, {})).rejects.toMatchObject({
        status: 503,
      });
      expect(forkMock).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousFlag === undefined) delete process.env.VAN_BLOG_PIPELINE_EXECUTION_ENABLED;
      else process.env.VAN_BLOG_PIPELINE_EXECUTION_ENABLED = previousFlag;
    }
  });

  it('installs only registry-style dependencies without lifecycle scripts', async () => {
    const provider = createProvider();
    spawnSyncMock.mockReturnValue({ status: 0 });

    await provider.addDeps(['lodash@4.17.21']);

    expect(spawnSyncMock).toHaveBeenCalledWith(
      'pnpm',
      ['add', '--ignore-scripts', 'lodash@4.17.21'],
      expect.objectContaining({
        cwd: '/tmp/codeRunner',
        timeout: 120000,
      }),
    );
    await expect(provider.addDeps(['git+https://example.com/evil.git'])).rejects.toThrow(
      '不允许安装该流水线依赖',
    );
  });

  it('writes a preload guard that blocks network and process escape modules', async () => {
    const provider = createProvider();
    await (provider as any).saveSandboxPreload();

    const preloadCall = writeFileSyncMock.mock.calls.find(
      (call) => call[0] === '/tmp/codeRunner/sandbox-preload.cjs',
    );
    expect(preloadCall).toBeTruthy();
    expect(preloadCall[1]).toContain("'child_process'");
    expect(preloadCall[1]).toContain("'https'");
    expect(preloadCall[1]).toContain("'tcp_wrap'");
    expect(preloadCall[1]).toContain('globalThis.fetch = undefined');
    expect(preloadCall[2]).toEqual({ encoding: 'utf-8', mode: 0o600 });
  });
});
