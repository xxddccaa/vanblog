import { getStoredUser } from '@/utils/getStoredUser';

// src/access.ts
export default function (initialState) {
  const user = initialState?.user || getStoredUser();
  const isSuperAdmin = user?.id == 0;
  let isAdmin = isSuperAdmin;
  if (user?.id != 0 && user?.permissions && user?.permissions?.includes('all')) {
    isAdmin = true;
  }
  // const isColl
  return {
    isCollaborator: user?.type && user?.type == 'collaborator',
    isAdmin,
    isSuperAdmin,
  };
}
