import { LogController } from './log.controller';
import { EventType } from 'src/provider/log/types';

describe('LogController', () => {
  it('uses cursor tail mode only for system logs', async () => {
    const logProvider = {
      tailSystemLog: jest.fn().mockResolvedValue({
        data: ['next'],
        total: 1,
        nextCursor: 'cursor-2',
        reset: false,
      }),
      searchLog: jest.fn(),
    };
    const controller = new LogController(logProvider as any);

    const result = await controller.get(
      1,
      20,
      EventType.SYSTEM,
      'true',
      'cursor-1',
      5000,
    );

    expect(logProvider.tailSystemLog).toHaveBeenCalledWith('cursor-1', 1000);
    expect(logProvider.searchLog).not.toHaveBeenCalled();
    expect(result).toEqual({
      statusCode: 200,
      data: {
        data: ['next'],
        total: 1,
        nextCursor: 'cursor-2',
        reset: false,
      },
    });
  });

  it('keeps the existing paginated event-log behavior', async () => {
    const logProvider = {
      tailSystemLog: jest.fn(),
      searchLog: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const controller = new LogController(logProvider as any);

    await controller.get(0, 999, EventType.LOGIN, 'true', 'ignored', 1000);

    expect(logProvider.searchLog).toHaveBeenCalledWith(1, 200, EventType.LOGIN);
    expect(logProvider.tailSystemLog).not.toHaveBeenCalled();
  });
});
