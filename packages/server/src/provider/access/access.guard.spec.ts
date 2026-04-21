import { AccessGuard } from './access.guard';

describe('AccessGuard', () => {
  const createRequest = (key: string, permissions?: string[]) => {
    const [method, ...pathParts] = key.split('-');
    return {
      route: {
        path: pathParts.join('-'),
        methods: {
          [method]: true,
        },
      },
      user: {
        id: 1,
        permissions,
      },
    };
  };

  it('denies zero-permission collaborators from reading private document APIs', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('get-/api/admin/document/:id', [])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/document/library/:id/export', [])),
    ).resolves.toBe(false);
  });

  it('denies zero-permission collaborators from reading article and draft editor data', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('get-/api/admin/article', [])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/article/:id', [])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/article/searchByLink', [])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/draft', [])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/draft/:id', [])),
    ).resolves.toBe(false);
  });

  it('allows document readers when they hold any document write permission', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('get-/api/admin/document/:id', ['document:update'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(
        createRequest('get-/api/admin/document/library/:id/export', ['document:create']),
      ),
    ).resolves.toBe(true);
  });

  it('allows article and draft readers when they hold matching write permissions', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('get-/api/admin/article', ['article:update'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/article/search', ['article:create'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/article/searchByLink', ['article:delete'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/draft', ['draft:update'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/draft/search', ['draft:publish'])),
    ).resolves.toBe(true);
  });

  it('keeps system takeover routes super-admin only even for collaborators with all permission', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('put-/api/admin/auth/', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/token/', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/backup/import', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/caddy/config', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/setting/login', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/search/all', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('put-/api/admin/meta/site', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/meta/social', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('delete-/api/admin/meta/link/:name', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/meta/menu/reset', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/analysis', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/log', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('delete-/api/admin/icon/:name', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('put-/api/admin/nav-category/sort/update', ['all'])),
    ).resolves.toBe(false);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/nav-tool', ['all'])),
    ).resolves.toBe(false);
  });

  it('still allows non-system collaborator routes for all-permission users', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('get-/api/admin/article', ['all'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('get-/api/admin/mindmap', ['all'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('post-/api/admin/ai-qa/chat', ['all'])),
    ).resolves.toBe(true);
    await expect(
      guard.validateRequest(createRequest('put-/api/admin/ai-qa/config', ['all'])),
    ).resolves.toBe(true);
  });

  it('keeps explicitly public collaborator routes available without extra permissions', async () => {
    const guard = new AccessGuard();

    await expect(
      guard.validateRequest(createRequest('post-/api/admin/img/upload', [])),
    ).resolves.toBe(true);
    await expect(guard.validateRequest(createRequest('get-/api/admin/meta', []))).resolves.toBe(true);
  });
});
