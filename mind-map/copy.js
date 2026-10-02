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

const copyConfiguredBuiltIndex = ({ src, dest }) => {
  // Keep the generated shell in dist when no destination is explicitly
  // provided. In particular, never overwrite the tracked mind-map/index.html.
  if (!dest) {
    return false;
  }

  return copyBuiltIndex({
    src,
    dest: path.resolve(dest),
  });
};

if (require.main === module) {
  const src = path.resolve(__dirname, './dist/index.html');
  copyConfiguredBuiltIndex({
    src,
    dest: process.env.MIND_MAP_INDEX_DEST,
  });
}

module.exports = { copyBuiltIndex, copyConfiguredBuiltIndex };
