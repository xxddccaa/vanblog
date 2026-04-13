type StoredUser = {
  id?: number;
  name?: string;
  nickname?: string;
  type?: string;
  permissions?: string[];
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return atob(padded);
}

export function getStoredUser(): StoredUser | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const token = window.localStorage.getItem('token');
  if (!token) {
    return undefined;
  }

  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));
    const id =
      typeof parsed?.sub === 'number'
        ? parsed.sub
        : Number.isFinite(Number(parsed?.sub))
          ? Number(parsed.sub)
          : undefined;

    return {
      id,
      name: parsed?.username,
      nickname: parsed?.nickname,
      type: parsed?.type,
      permissions: Array.isArray(parsed?.permissions) ? parsed.permissions : [],
    };
  } catch (error) {
    console.error('解析本地登录态失败:', error);
    return undefined;
  }
}

