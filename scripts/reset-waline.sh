#!/bin/bash
set -e

# 1) 找到 Mongo 容器
container_id=$(docker ps --format '{{.ID}} {{.Names}}' | awk '$2 ~ /mongo/ {print $1}' | head -n1)
if [ -z "$container_id" ]; then
  echo "No running MongoDB container found."
  exit 1
fi
echo "Found MongoDB container: $container_id"

# 2) 配置要重置的邮箱与bcrypt哈希（默认是明文 123123 的示例哈希）
NEW_EMAIL="admin@admin.com"
# 123123 的示例 bcrypt 哈希（cost=10）。如需自定义密码，可替换为你的哈希。
NEW_HASH='$2a$10$2b2do7uD8xCw8lJSBHZxpeGm2Y2YtqB6b9i9f0x3rB3M4KJrMEPqu'

# 3) 生成执行脚本（兼容 users 与 Users 集合）
cat > updateAdmin.js <<'EOF'
(function(){
  const EMAIL = "__NEW_EMAIL__";
  const HASH = "__NEW_HASH__";
  const targets = ['users', 'Users'];

  function upsertAdmin(col) {
    return db.getCollection(col).updateOne(
      { email: EMAIL },
      { $set: { type: 'administrator', email: EMAIL, password: HASH } },
      { upsert: true }
    );
  }

  let has = false;
  const cols = db.getCollectionNames();
  for (const col of targets) {
    if (cols.indexOf(col) >= 0) {
      print('upsert admin in collection:', col);
      printjson(upsertAdmin(col));
      has = true;
    }
  }
  if (!has) {
    print('No users collection found. Creating `users` collection via upsert...');
    printjson(upsertAdmin('users'));
  }
})();
EOF

sed -i "s|__NEW_EMAIL__|${NEW_EMAIL}|g" updateAdmin.js
sed -i "s|__NEW_HASH__|${NEW_HASH}|g" updateAdmin.js

docker cp updateAdmin.js "$container_id":/tmp/updateAdmin.js
docker exec -i "$container_id" mongo waline /tmp/updateAdmin.js
rm -f updateAdmin.js

echo
echo "管理员邮箱/密码已重置为：${NEW_EMAIL} / 123123（示例）。"
echo "下一步：后台 → 系统设置 → 评论设置，把“作者邮箱”设置为 ${NEW_EMAIL}，保存后："
echo "docker compose down && docker compose up -d"
echo "清浏览器 Cookie 后，访问 https://你的域名/api/ui/ 重新登录"