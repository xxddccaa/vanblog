import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PIPELINE_SANDBOX_PRELOAD } from './pipelineSandbox';

describe('pipeline sandbox', () => {
  it('enforces Node permissions and blocks network escape APIs in a real Node 22 process', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vanblog-pipeline-sandbox-'));
    const preloadPath = join(directory, 'sandbox-preload.cjs');
    const runnerPath = join(directory, 'runner.cjs');

    try {
      writeFileSync(preloadPath, PIPELINE_SANDBOX_PRELOAD, { mode: 0o600 });
      writeFileSync(
        runnerPath,
        `
          const fs = require('node:fs');
          const result = {
            allowedRead: fs.readFileSync(__filename, 'utf8').includes('allowedRead'),
            httpBlocked: false,
            outsideReadBlocked: false,
            rawNetworkBindingBlocked: false,
          };
          try { require('node:http'); } catch { result.httpBlocked = true; }
          try { fs.readFileSync('/etc/passwd'); } catch (error) {
            result.outsideReadBlocked = error && error.code === 'ERR_ACCESS_DENIED';
          }
          try { process.binding('tcp_wrap'); } catch {
            result.rawNetworkBindingBlocked = true;
          }
          process.stdout.write(JSON.stringify(result));
        `,
        { mode: 0o600 },
      );

      const output = execFileSync(
        process.execPath,
        [
          '--permission',
          `--allow-fs-read=${directory}`,
          `--require=${preloadPath}`,
          runnerPath,
        ],
        { encoding: 'utf8', timeout: 10000 },
      );

      expect(JSON.parse(output)).toEqual({
        allowedRead: true,
        httpBlocked: true,
        outsideReadBlocked: true,
        rawNetworkBindingBlocked: true,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
