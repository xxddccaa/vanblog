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
});
