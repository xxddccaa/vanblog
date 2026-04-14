import { VisitProvider } from './visit.provider';

describe('VisitProvider', () => {
  it('imports visits with targeted PG upserts instead of refreshing the whole visit table', async () => {
    const visitModel = {
      updateOne: jest.fn(),
    };
    const VisitCtor = function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = jest.fn().mockResolvedValue(this);
    } as any;
    Object.assign(VisitCtor, visitModel);

    const structuredDataService = {
      getVisitByDateAndPath: jest.fn().mockResolvedValue(null),
      isInitialized: jest.fn().mockReturnValue(true),
      upsertVisit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new VisitProvider(VisitCtor, structuredDataService as any);

    await provider.import([{ date: '2024-01-01', pathname: '/post/1', viewer: 1, visited: 1 } as any]);

    expect(structuredDataService.upsertVisit).toHaveBeenCalledWith({
      date: '2024-01-01',
      pathname: '/post/1',
      viewer: 1,
      visited: 1,
    });
  });

  it('updates imported visits using the PG snapshot when a record already exists', async () => {
    const visitModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const VisitCtor = function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = jest.fn().mockResolvedValue(this);
    } as any;
    Object.assign(VisitCtor, visitModel);

    const structuredDataService = {
      getVisitByDateAndPath: jest.fn().mockResolvedValue({
        date: '2024-01-01',
        pathname: '/post/1',
        viewer: 1,
        visited: 1,
      }),
      isInitialized: jest.fn().mockReturnValue(true),
      upsertVisit: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new VisitProvider(VisitCtor, structuredDataService as any);

    await provider.import([{ date: '2024-01-01', pathname: '/post/1', viewer: 6, visited: 5 } as any]);

    expect(visitModel.updateOne).toHaveBeenCalledWith(
      { pathname: '/post/1', date: '2024-01-01' },
      { date: '2024-01-01', pathname: '/post/1', viewer: 6, visited: 5 },
    );
    expect(structuredDataService.upsertVisit).toHaveBeenCalledWith({
      date: '2024-01-01',
      pathname: '/post/1',
      viewer: 6,
      visited: 5,
    });
  });
});
