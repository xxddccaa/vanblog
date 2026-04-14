import { CollaboratorController } from './collaborator.controller';

describe('CollaboratorController', () => {
  it('does not leak login usernames from the public collaborator list endpoint', async () => {
    const controller = new CollaboratorController(
      {
        getUser: jest.fn().mockResolvedValue({
          id: 0,
          name: 'admin-login',
          nickname: '站长',
        }),
        getAllCollaborators: jest.fn().mockResolvedValue([
          { id: 2, name: 'writer-login', nickname: '作者甲' },
          { id: 3, name: 'editor-login', nickname: '' },
        ]),
      } as any,
      {
        getSiteInfo: jest.fn().mockResolvedValue({
          author: '公开作者名',
        }),
      } as any,
      {} as any,
    );

    const result = await controller.getAllCollaboratorsList();

    expect(result).toEqual({
      statusCode: 200,
      data: [
        { id: 0, nickname: '公开作者名' },
        { id: 2, nickname: '作者甲' },
        { id: 3, nickname: '协作者' },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('admin-login');
    expect(JSON.stringify(result)).not.toContain('writer-login');
    expect(JSON.stringify(result)).not.toContain('editor-login');
  });
});
