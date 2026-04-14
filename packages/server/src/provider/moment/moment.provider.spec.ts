import { MomentProvider } from './moment.provider';

describe('MomentProvider', () => {
  it('does not apply limit/skip when pageSize is non-positive', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => Promise.resolve(resolve([{ id: 1 }, { id: 2 }]))),
    };
    const momentModel = {
      countDocuments: jest.fn().mockResolvedValue(2),
      find: jest.fn().mockReturnValue(query),
    };

    const provider = new MomentProvider(
      momentModel as any,
      {
        queryMoments: jest.fn().mockResolvedValue({ moments: [], total: 0 }),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );
    const result = await provider.getByOption({ page: 1, pageSize: -1 }, false);

    expect(result.moments).toHaveLength(2);
    expect(momentModel.find).toHaveBeenCalled();
    expect(query.sort).toHaveBeenCalled();
    expect(query.skip).not.toHaveBeenCalled();
    expect(query.limit).not.toHaveBeenCalled();
  });

  it('returns no moments for blank searches without issuing a fallback query', async () => {
    const momentModel = {
      find: jest.fn(),
    };
    const provider = new MomentProvider(
      momentModel as any,
      {
        searchMoments: jest.fn().mockResolvedValue([]),
        isInitialized: jest.fn().mockReturnValue(false),
      } as any,
    );

    const result = await provider.searchByString('   ');

    expect(result).toEqual([]);
    expect(momentModel.find).not.toHaveBeenCalled();
  });
});
