import { loadConfig } from 'src/utils/loadConfig';

export interface Config {
  databaseUrl: string;
  redisUrl: string;
  walineDatabaseUrl: string;
  staticPath: string;
  codeRunnerPath: string;
  pluginRunnerPath: string;
  walineDB: string;
  demo: boolean | string;
  log: string;
}

export const loadDatabaseUrl = () =>
  loadConfig('database.url', 'postgresql://postgres:postgres@postgres:5432/vanblog');

export const config: Config = {
  databaseUrl: loadDatabaseUrl(),
  redisUrl: loadConfig('redis.url', 'redis://redis:6379'),
  walineDatabaseUrl: loadConfig('waline.databaseUrl', ''),
  staticPath: loadConfig('static.path', '/app/static'),
  demo: loadConfig('demo', false),
  walineDB: loadConfig('waline.db', 'waline'),
  log: loadConfig('log', '/var/log'),
  codeRunnerPath: loadConfig('codeRunner.path', '/app/codeRunner'),
  pluginRunnerPath: loadConfig('pluginRunner.path', '/app/pluginRunner'),
};
