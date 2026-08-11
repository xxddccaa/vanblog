import {
  DiagramController,
  resetDiagramControllerStateForTests,
} from './diagram.controller';

function createResponse() {
  const state: any = { statusCode: 200, headers: {}, body: undefined };
  const response = {
    status: jest.fn((code: number) => {
      state.statusCode = code;
      return response;
    }),
    json: jest.fn((body: any) => {
      state.body = body;
      return response;
    }),
    send: jest.fn((body: any) => {
      state.body = body;
      return response;
    }),
    setHeader: jest.fn((name: string, value: string) => {
      state.headers[name] = value;
    }),
  };
  return { response, state };
}

function createController() {
  const counters = new Map<string, number>();
  const cacheProvider = {
    incrementWithTtl: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
  };
  return {
    controller: new DiagramController(cacheProvider as any),
    cacheProvider,
  };
}

describe('DiagramController', () => {
  const request = { ip: '203.0.113.10', socket: {} } as any;

  beforeEach(() => {
    resetDiagramControllerStateForTests();
    jest.restoreAllMocks();
  });

  it('rejects diagram sources over 256 KiB before contacting an upstream', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { response, state } = createResponse();

    await createController().controller.render(
      { type: 'mermaid', source: 'a'.repeat(256 * 1024 + 1) },
      request,
      response as any,
    );

    expect(state.statusCode).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps PNG responses as binary bytes and caches the same Buffer', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0xff, 0x80]);
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(png, { status: 200 }) as any);
    const { controller } = createController();
    const first = createResponse();
    const second = createResponse();

    await controller.render(
      { type: 'mermaid', source: 'graph TD; A-->B', format: 'png' },
      request,
      first.response as any,
    );
    await controller.render(
      { type: 'mermaid', source: 'graph TD; A-->B', format: 'png' },
      request,
      second.response as any,
    );

    expect(Buffer.isBuffer(first.state.body)).toBe(true);
    expect(first.state.body).toEqual(png);
    expect(second.state.body).toEqual(png);
    expect(second.state.headers['X-Diagram-Cache']).toBe('hit');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts processing when an upstream response exceeds 5 MiB', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('too large', {
        status: 200,
        headers: { 'content-length': String(5 * 1024 * 1024 + 1) },
      }) as any,
    );
    const { response, state } = createResponse();

    await createController().controller.render(
      { type: 'mermaid', source: 'graph TD; A-->B' },
      request,
      response as any,
    );

    expect(state.statusCode).toBe(503);
    expect(state.body).toEqual({ message: 'Kroki service unavailable' });
  });

  it('rate limits repeated requests from one client', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<svg/>', { status: 200 }) as any);
    const { controller } = createController();

    for (let index = 0; index < 30; index += 1) {
      const current = createResponse();
      await controller.render(
        { type: 'mermaid', source: 'graph TD; A-->B' },
        request,
        current.response as any,
      );
      expect(current.state.statusCode).toBe(200);
    }
    const limited = createResponse();
    await controller.render(
      { type: 'mermaid', source: 'graph TD; A-->B' },
      request,
      limited.response as any,
    );

    expect(limited.state.statusCode).toBe(429);
  });
});
