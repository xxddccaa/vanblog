export const getVersionFromServer = async () => {
  // 返回固定版本号，不再调用外部API
  return {
    version: 'v1.0.0',
    updatedAt: new Date().toISOString(),
  };
};
