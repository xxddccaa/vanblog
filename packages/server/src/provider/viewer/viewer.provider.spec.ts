import { ViewerProvider } from './viewer.provider';

describe('ViewerProvider', () => {
  it('imports viewers with targeted PG upserts instead of refreshing the whole viewer table', async () => {
    const viewerModel = {
      updateOne: jest.fn(),
    };
    const ViewerCtor = function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = jest.fn().mockResolvedValue(this);
    } as any;
    Object.assign(ViewerCtor, viewerModel);

    const structuredDataService = {
      getViewerByDate: jest.fn().mockResolvedValue(null),
      isInitialized: jest.fn().mockReturnValue(true),
      upsertViewer: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new ViewerProvider(ViewerCtor, structuredDataService as any);

    await provider.import([{ date: '2024-01-01', viewer: 1, visited: 2 } as any]);

    expect(structuredDataService.upsertViewer).toHaveBeenCalledWith({
      date: '2024-01-01',
      viewer: 1,
      visited: 2,
    });
  });

  it('updates imported viewers using the PG snapshot when a record already exists', async () => {
    const viewerModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const ViewerCtor = function (this: any, payload: any) {
      Object.assign(this, payload);
      this.save = jest.fn().mockResolvedValue(this);
    } as any;
    Object.assign(ViewerCtor, viewerModel);

    const structuredDataService = {
      getViewerByDate: jest.fn().mockResolvedValue({
        date: '2024-01-01',
        viewer: 3,
        visited: 4,
      }),
      isInitialized: jest.fn().mockReturnValue(true),
      upsertViewer: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new ViewerProvider(ViewerCtor, structuredDataService as any);

    await provider.import([{ date: '2024-01-01', viewer: 8, visited: 9 } as any]);

    expect(viewerModel.updateOne).toHaveBeenCalledWith(
      { date: '2024-01-01' },
      { date: '2024-01-01', viewer: 8, visited: 9 },
    );
    expect(structuredDataService.upsertViewer).toHaveBeenCalledWith({
      date: '2024-01-01',
      viewer: 8,
      visited: 9,
    });
  });
});
