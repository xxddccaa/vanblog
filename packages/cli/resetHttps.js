#!/usr/bin/env node

const { Client } = require('pg');

const defaultUrl = 'postgresql://postgres:postgres@postgres:5432/vanblog';

const readString = (prompt) => {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
};

const main = async () => {
  const urlFromUser = await readString(
    '输入 PostgreSQL 连接 URL（默认回车使用内置值）:    \n  ',
  );
  const connectionString = urlFromUser || defaultUrl;
  if (
    !connectionString.startsWith('postgres://') &&
    !connectionString.startsWith('postgresql://')
  ) {
    console.log('当前 resetHttps 只支持 PostgreSQL 连接串');
    process.exit(1);
  }

  console.log('使用的 PostgreSQL 连接 URL: ', connectionString);
  const client = new Client({ connectionString });
  console.log('尝试连接数据库...');

  try {
    await tryConnectDB(client);
    console.log('连接数据库成功');
  } catch (err) {
    console.log('连接数据库失败：', err);
    process.exit(1);
  }

  await resetHttps(client);
  await client.end();
  process.exit(0);
};

const tryConnectDB = (client) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('连接数据库超时'));
    }, 5000);

    client
      .connect()
      .then(() => {
        clearTimeout(timer);
        resolve(undefined);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const resetHttps = async (client) => {
  try {
    const result = await client.query(
      `DELETE FROM vanblog_settings WHERE setting_type = 'https'`,
    );
    console.log('删除 HTTPS 设置成功，删除的条目数：', result.rowCount || 0);
    console.log('重启 vanblog 后生效');
  } catch (err) {
    console.log('重制 HTTPS 出错：', err);
  }
};

main();
