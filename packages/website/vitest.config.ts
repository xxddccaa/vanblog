import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 全量套件并行执行且机器同时跑着 Docker 栈时，个别 spec 首次转换会超过
    // 默认 5s 超时（单跑只要几百毫秒），放宽避免发版门槛被资源竞争打断。
    testTimeout: 20000,
  },
});
