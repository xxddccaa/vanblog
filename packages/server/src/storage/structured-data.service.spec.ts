import { StructuredDataService } from './structured-data.service';

describe('StructuredDataService', () => {
  it('clamps user sequence updates to at least 1 when restoring admin id 0', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await (service as any).ensureSequenceAtLeast('vanblog_users_id_seq', 0);

    expect(store.query).toHaveBeenCalledWith(
      expect.stringContaining('GREATEST('),
      ['vanblog_users_id_seq', 'vanblog_users_id_seq', 0, 1],
    );
  });

  it('persists admin user id 0 without attempting to move the sequence below 1', async () => {
    const store = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const service = new StructuredDataService(store as any);

    await service.upsertUser({
      id: 0,
      name: 'dong',
      password: 'hash',
      salt: 'salt',
      type: 'admin',
    });

    expect(store.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT setval'),
      ['vanblog_users_id_seq', 'vanblog_users_id_seq', 0, 1],
    );
    expect(store.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO vanblog_users'),
      expect.arrayContaining([0, 'dong', 'hash']),
    );
  });
});
