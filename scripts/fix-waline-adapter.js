const fs = require('fs');
const { execSync } = require('child_process');

const walineRoot = process.env.WALINE_ROOT || '/app/waline';

console.log(`开始修复 Waline adapter sqlite 加载日志: ${walineRoot}`);

let adapterPath = null;

try {
  const findResult = execSync(
    `find ${JSON.stringify(walineRoot)} -name "adapter.js" -path "*/@waline/vercel/src/config/*" 2>/dev/null`,
  )
    .toString()
    .trim();
  const paths = findResult.split('\n').filter((item) => item.trim());
  adapterPath = paths[0];

  if (!adapterPath) {
    throw new Error('未找到 Waline adapter.js 文件');
  }

  console.log('找到 Waline adapter.js 文件:', adapterPath);
} catch (error) {
  console.error('查找 Waline adapter.js 文件失败:', error.message);
  process.exit(1);
}

try {
  const original = fs.readFileSync(adapterPath, 'utf-8');

  if (original.includes("if (process.env.SQLITE_PATH) console.log(err);")) {
    console.log('Waline adapter sqlite 加载日志已修复，无需重复处理');
    process.exit(0);
  }

  const source = `} catch (err) {
  // oxlint-disable-next-line typescript/no-extraneous-class
  Sqlite = class {};
  console.log(err);
}`;
  const target = `} catch (err) {
  // oxlint-disable-next-line typescript/no-extraneous-class
  Sqlite = class {};
  if (process.env.SQLITE_PATH) console.log(err);
}`;

  if (!original.includes(source)) {
    throw new Error('未找到可修复的 Waline adapter sqlite 日志代码块');
  }

  fs.writeFileSync(`${adapterPath}.backup`, original);
  fs.writeFileSync(adapterPath, original.replace(source, target), 'utf-8');
  console.log('Waline adapter sqlite 加载日志修复完成');
  console.log('原文件已备份为:', `${adapterPath}.backup`);
} catch (error) {
  console.error('修复 Waline adapter 时出错:', error.message);
  process.exit(1);
}
