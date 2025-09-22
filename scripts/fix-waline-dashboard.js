const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('开始修复 Waline dashboard serverURL 配置...');

// 首先查找 dashboard.js 文件的实际路径
let dashboardPath = null;

try {
  // 查找文件
  const findResult = execSync('find /app/waline -name "dashboard.js" -path "*/middleware/*" 2>/dev/null').toString().trim();
  const paths = findResult.split('\n').filter(p => p.trim());
  
  // 选择源文件而不是编译后的dist文件
  dashboardPath = paths.find(p => p.includes('/src/')) || paths[0];
  
  if (!dashboardPath) {
    console.log('未找到 dashboard.js 文件，跳过修复');
    process.exit(0);
  }
  
  console.log('找到 dashboard.js 文件:', dashboardPath);
} catch (error) {
  console.log('查找 dashboard.js 文件失败，跳过修复');
  process.exit(0);
}

try {
  // 读取文件内容
  let content = fs.readFileSync(dashboardPath, 'utf-8');
  let modified = false;
  
  // 修复方案1: 将 SITE_URL 改为空字符串，让前端使用相对路径
  const siteUrlPattern = /window\.SITE_URL\s*=\s*\$\{JSON\.stringify\(process\.env\.SITE_URL\)\};/;
  if (siteUrlPattern.test(content)) {
    content = content.replace(siteUrlPattern, 'window.SITE_URL = "";');
    modified = true;
    console.log('已修复 window.SITE_URL 配置 - 设为空字符串使用相对路径');
  }
  
  // 备用修复方案2: 查找其他可能的serverURL模式
  const serverUrlPattern = /window\.serverURL\s*=\s*['"`][^'"`]*\/api\/['"`]/g;
  if (serverUrlPattern.test(content)) {
    content = content.replace(serverUrlPattern, "window.serverURL = '/api/'");
    modified = true;
    console.log('已修复 window.serverURL 配置');
  }
  
  // 修复方案3: 如果有其他形式的serverURL配置
  const ctxServerUrlPattern = /(['"`])\$\{[^}]*serverURL[^}]*\}\/api\/\1/g;
  if (ctxServerUrlPattern.test(content)) {
    content = content.replace(ctxServerUrlPattern, "'/api/'");
    modified = true;
    console.log('已修复 serverURL 模板字符串配置');
  }
  
  // 如果进行了修改，写回文件
  if (modified) {
    // 备份原文件
    fs.writeFileSync(dashboardPath + '.backup', fs.readFileSync(dashboardPath));
    fs.writeFileSync(dashboardPath, content, 'utf-8');
    console.log('Waline dashboard serverURL 修复完成！');
    console.log('原文件已备份为:', dashboardPath + '.backup');
  } else {
    console.log('未找到需要修复的配置，可能文件已经是正确的或格式不同');
    console.log('文件内容预览:');
    console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
  }
  
} catch (error) {
  console.error('修复Waline dashboard时出错:', error.message);
  console.log('继续启动，但评论管理功能可能有问题');
} 