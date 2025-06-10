#! /usr/bin/env node
const { spawn } = require('child_process');
const { writeFileSync } = require('fs');
const { join } = require('path');
let logPath = `/var/log/`;
if (process.platform === 'win32') {
  logPath = join(__dirname, '../log');
}

const logPathEnv = process.env.VAN_BLOG_LOG;
if (logPathEnv) {
  logPath = logPathEnv;
}

const printLog = (string, isError = false) => {
  const logName = `vanblog-${isError ? 'stderr' : 'stdout'}.log`;
  const logNameNormal = `vanblog-stdio.log`;
  writeFileSync(join(logPath, logName), string, { flag: 'a' });
  writeFileSync(join(logPath, logNameNormal), string, { flag: 'a' });
};

// 预热动态页面功能
const warmupPages = async () => {
  try {
    // 等待5秒确保服务完全启动
    setTimeout(async () => {
      try {
        const http = require('http');
        console.log('🔥 开始预热页面...');
        
        // 预热个人动态页面
        const momentOptions = {
          hostname: '127.0.0.1',
          port: 3001,
          path: '/moment',
          method: 'GET',
          timeout: 10000,
        };

        const momentReq = http.request(momentOptions, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ 动态页面预热成功');
            printLog('✅ 动态页面预热成功\n', false);
          } else {
            console.log('⚠️ 动态页面预热失败，状态码:', res.statusCode);
            printLog(`⚠️ 动态页面预热失败，状态码: ${res.statusCode}\n`, false);
          }
        });

        momentReq.on('error', (error) => {
          console.log('⚠️ 动态页面预热出错:', error.message);
          printLog(`⚠️ 动态页面预热出错: ${error.message}\n`, false);
        });

        momentReq.on('timeout', () => {
          console.log('⚠️ 动态页面预热超时');
          printLog('⚠️ 动态页面预热超时\n', false);
          momentReq.destroy();
        });

        momentReq.end();
        
        // 预热导航页面
        const navOptions = {
          hostname: '127.0.0.1',
          port: 3001,
          path: '/nav',
          method: 'GET',
          timeout: 10000,
        };

        const navReq = http.request(navOptions, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ 导航页面预热成功');
            printLog('✅ 导航页面预热成功\n', false);
          } else {
            console.log('⚠️ 导航页面预热失败，状态码:', res.statusCode);
            printLog(`⚠️ 导航页面预热失败，状态码: ${res.statusCode}\n`, false);
          }
        });

        navReq.on('error', (error) => {
          console.log('⚠️ 导航页面预热出错:', error.message);
          printLog(`⚠️ 导航页面预热出错: ${error.message}\n`, false);
        });

        navReq.on('timeout', () => {
          console.log('⚠️ 导航页面预热超时');
          printLog('⚠️ 导航页面预热超时\n', false);
          navReq.destroy();
        });

        navReq.end();
      } catch (error) {
        console.log('⚠️ 页面预热出错:', error.message);
        printLog(`⚠️ 页面预热出错: ${error.message}\n`, false);
      }
    }, 5000);
  } catch (error) {
    console.log('预热功能初始化失败:', error.message);
  }
};

// 备选预热方案：定时触发
let warmupTriggered = false;
setTimeout(() => {
  if (!warmupTriggered) {
    console.log('🔥 备选预热方案启动...');
    warmupTriggered = true;
    warmupPages();
  }
}, 15000); // 15秒后如果还没触发过预热，则强制触发

const ctx = spawn('node', ['main.js'], {
  cwd: '/app/server',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
  },
});

ctx.on('exit', () => {
  process.stderr.write(`[vanblog] 已停止`);
});

ctx.stdout.on('data', (data) => {
  printLog(data.toString(), false);
  process.stdout.write(data.toString());
  
  // 检测服务器启动完成的标志
  const output = data.toString();
  if (output.includes('服务器启动成功') || 
      output.includes('Server started') ||
      output.includes('started on') ||
      output.includes('listening on') ||
      output.includes('ready on')) {
    if (!warmupTriggered) {
      warmupTriggered = true;
      warmupPages();
    }
  }
});

ctx.stderr.on('data', (data) => {
  printLog(data.toString(), true);
  process.stderr.write(data.toString());
});

process.on('SIGINT', async () => {
  ctx.unref();
  process.kill(-ctx.pid, 'SIGINT');
  console.log('检测到关闭信号，优雅退出！');
  process.exit();
});
