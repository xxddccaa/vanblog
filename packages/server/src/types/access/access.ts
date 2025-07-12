export type LimitPermission =
  | 'article:create'
  | 'article:delete'
  | 'article:update'
  | 'draft:publish'
  | 'draft:create'
  | 'draft:delete'
  | 'draft:update'
  | 'document:create'
  | 'document:delete'
  | 'document:update'
  | 'img:delete';

export type Permission = LimitPermission | 'all';

export const permissionPathMap: Record<LimitPermission, string> = {
  'article:create': 'post-/api/admin/article',
  'article:delete': 'delete-/api/admin/article/:id',
  'article:update': 'put-/api/admin/article/:id',
  'draft:create': 'post-/api/admin/draft',
  'draft:publish': 'post-/api/admin/draft/publish',
  'draft:delete': 'delete-/api/admin/draft/:id',
  'draft:update': 'put-/api/admin/draft/:id',
  'document:create': 'post-/api/admin/document',
  'document:delete': 'delete-/api/admin/document/:id',
  'document:update': 'put-/api/admin/document/:id',
  'img:delete': 'delete-/api/admin/img/:sign',
};

export const pathPermissionMap: Record<string, LimitPermission> = {
  'post-/api/admin/article': 'article:create',
  'delete-/api/admin/article/:id': 'article:delete',
  'put-/api/admin/article/:id': 'article:update',
  'post-/api/admin/draft/publish': 'draft:publish',
  'post-/api/admin/draft': 'draft:create',
  'delete-/api/admin/draft/:id': 'draft:delete',
  'put-/api/admin/draft/:id': 'draft:update',
  'post-/api/admin/document': 'document:create',
  'delete-/api/admin/document/:id': 'document:delete',
  'put-/api/admin/document/:id': 'document:update',
  'delete-/api/admin/img/:sign': 'img:delete',
};

export const permissionRoutes = Object.values(permissionPathMap);

export const publicRoutes = [
  'get-/api/admin/meta',
  'post-/api/admin/auth/login',
  'post-/api/admin/auth/logout',
  'get-/api/admin/article',
  'get-/api/admin/draft',
  'get-/api/admin/category/all',
  'get-/api/admin/tag/all',
  'get-/api/admin/article/:id',
  'get-/api/admin/draft/:id',
  'get-/api/admin/img/all',
  'get-/api/admin/img',
  'get-/api/admin/collaborator/list',
  'post-/api/admin/img/upload',
  'post-/api/admin/article/searchByLink',
  'get-/api/admin/document',
  'get-/api/admin/document/:id',
  'get-/api/admin/document/tree',
  'get-/api/admin/document/libraries',
  'get-/api/admin/document/library/:id',
];
