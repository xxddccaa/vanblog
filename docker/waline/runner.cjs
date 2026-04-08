const http = require('http');
const { spawn } = require('child_process');

const controlPort = parseInt(process.env.WALINE_CONTROL_PORT || '8361', 10);
const childPort = process.env.PORT || '8360';
let runtimeEnv = {};
let child = null;

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const waitForExit = (proc, timeoutMs) =>
  new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve();
    }, timeoutMs);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });

const startChild = () => {
  child = spawn('node', ['node_modules/@waline/vercel/vanilla.js'], {
    cwd: '/app/waline',
    env: {
      ...process.env,
      ...runtimeEnv,
      PORT: childPort,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    const wasManagedRestart = child === null;
    if (!wasManagedRestart) {
      console.warn(`[waline-runner] waline exited with code=${code} signal=${signal}`);
      child = null;
    }
  });
};

const restartChild = async (envPatch = {}) => {
  runtimeEnv = {
    ...runtimeEnv,
    ...envPatch,
  };
  const current = child;
  child = null;
  if (current) {
    await waitForExit(current, 10000);
  }
  startChild();
};

const stopChild = async () => {
  const current = child;
  child = null;
  if (current) {
    await waitForExit(current, 10000);
  }
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, child ? 200 : 503, { ok: !!child, running: !!child, port: childPort });
      return;
    }

    if (req.method === 'POST' && req.url === '/restart') {
      const body = await parseBody(req);
      await restartChild(body.env || {});
      sendJson(res, 200, { ok: true, running: true });
      return;
    }

    if (req.method === 'POST' && req.url === '/stop') {
      await stopChild();
      sendJson(res, 200, { ok: true, running: false });
      return;
    }

    sendJson(res, 404, { ok: false, message: 'not found' });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message });
  }
});

process.on('SIGTERM', async () => {
  await stopChild();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await stopChild();
  process.exit(0);
});

server.listen(controlPort, '0.0.0.0', () => {
  console.log(`[waline-runner] control server listening on ${controlPort}`);
});

restartChild().catch((error) => {
  console.error('[waline-runner] failed to start waline', error);
  process.exit(1);
});
