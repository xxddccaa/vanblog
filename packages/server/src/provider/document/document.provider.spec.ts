import { DocumentProvider } from './document.provider';

describe('DocumentProvider', () => {
  it('does not apply limit/skip when pageSize is non-positive', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ id: 10 }, { id: 11 }]),
    };
    const documentModel = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      }),
    };

    const provider = new DocumentProvider(documentModel as any, {} as any);
    const result = await provider.getByOption({ page: 1, pageSize: -1 });

    expect(result.documents).toHaveLength(2);
    expect(documentModel.find).toHaveBeenCalled();
    expect(query.sort).toHaveBeenCalled();
    expect(query.skip).not.toHaveBeenCalled();
    expect(query.limit).not.toHaveBeenCalled();
  });
});
