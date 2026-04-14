import { PublicMomentController } from './moment.controller';

describe('PublicMomentController', () => {
  it('sets Last-Modified from the latest public moment timestamp', async () => {
    const headers = new Map<string, string>();
    const controller = new PublicMomentController({
      getByOption: jest.fn().mockResolvedValue({
        total: 2,
        moments: [
          {
            id: 1,
            content: 'hello',
            createdAt: '2026-04-10T00:00:00.000Z',
            updatedAt: '2026-04-10T00:00:00.000Z',
          },
          {
            id: 2,
            content: 'world',
            createdAt: '2026-04-11T00:00:00.000Z',
            updatedAt: '2026-04-11T00:00:00.000Z',
          },
        ],
      }),
    } as any);

    const result = await controller.getByOption(1, 10, undefined, undefined, undefined, {
      setHeader: (key: string, value: string) => headers.set(key, value),
    } as any);

    expect(result).toEqual({
      statusCode: 200,
      data: {
        total: 2,
        moments: [
          {
            id: 1,
            content: 'hello',
            createdAt: '2026-04-10T00:00:00.000Z',
            updatedAt: '2026-04-10T00:00:00.000Z',
          },
          {
            id: 2,
            content: 'world',
            createdAt: '2026-04-11T00:00:00.000Z',
            updatedAt: '2026-04-11T00:00:00.000Z',
          },
        ],
      },
    });
    expect(headers.get('Last-Modified')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
  });

  it('clamps oversized public moment pagination before querying the provider', async () => {
    const getByOption = jest.fn().mockResolvedValue({
      total: 0,
      moments: [],
    });
    const controller = new PublicMomentController({
      getByOption,
    } as any);

    await controller.getByOption(
      '0' as any,
      '999' as any,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    expect(getByOption).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 50,
      }),
      true,
    );
  });
});
