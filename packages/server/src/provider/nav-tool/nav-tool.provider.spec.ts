import { NavToolProvider } from './nav-tool.provider';

describe('NavToolProvider', () => {
  it('updates nav tool sort order in PG without refreshing the whole structured table', async () => {
    const navToolModel = {
      bulkWrite: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const structuredDataService = {
      updateNavToolSorts: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new NavToolProvider(
      navToolModel as any,
      {} as any,
      structuredDataService as any,
    );

    await provider.updateToolsSort([
      { id: 'tool-a', sort: 3 },
      { id: 'tool-b', sort: 4 },
    ]);

    expect(navToolModel.bulkWrite).toHaveBeenCalledTimes(1);
    expect(structuredDataService.updateNavToolSorts).toHaveBeenCalledWith(
      [
        { id: 'tool-a', sort: 3 },
        { id: 'tool-b', sort: 4 },
      ],
      expect.any(Date),
    );
  });
});
