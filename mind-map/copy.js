const fs = require('fs');
const path = require('path');

const copyBuiltIndex = ({ src, dest }) => {
  if (!fs.existsSync(src)) {
    return false;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.unlinkSync(src);
  return true;
};

if (require.main === module) {
  const src = path.resolve(__dirname, './dist/index.html');
  const dest = process.env.MIND_MAP_INDEX_DEST || path.resolve(__dirname, './index.html');
  copyBuiltIndex({ src, dest });
}

module.exports = { copyBuiltIndex };
