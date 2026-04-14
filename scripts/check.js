// PG-aware helper for inserting a `<!-- more -->` marker into article content.
const { Client } = require('pg');
const fs = require('fs');
const yaml = require('yaml');

const data = yaml.parse(fs.readFileSync('config.yaml', { encoding: 'utf-8' }));

if (!data || !data.url) {
  console.log("cant's parse url");
  process.exit(1);
}

const url = String(data.url || '');
if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
  console.error('scripts/check.js 现在仅支持 PostgreSQL 连接串');
  process.exit(1);
}

const client = new Client({
  connectionString: url,
});

const addMoreMarker = (content) => {
  const text = String(content || '');
  if (text.includes('<!-- more -->')) {
    return null;
  }
  if (text.includes('# ')) {
    if (text.includes('## ')) {
      const p = text.indexOf('## ');
      return `${text.substring(0, p - 1)}\n<!-- more -->\n${text.substring(p)}`;
    }
    return `${text}\n<!-- more -->\n`;
  }
  return `${text}\n<!-- more -->\n`;
};

async function run() {
  await client.connect();
  try {
    const { rows: articles } = await client.query(
      `
        SELECT id, title, content
        FROM vanblog_articles
        WHERE deleted = FALSE
        ORDER BY id ASC
      `,
    );

    for (const article of articles) {
      const newContent = addMoreMarker(article.content);
      if (!newContent) {
        continue;
      }
      console.log(article.title);
      const result = await client.query(
        `
          UPDATE vanblog_articles
          SET content = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [article.id, newContent],
      );
      console.log(result.rowCount);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
