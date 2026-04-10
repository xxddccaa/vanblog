import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const caddyfile = fs.readFileSync('docker/caddy/Caddyfile', 'utf8');

test('docker compose defines the split runtime services', () => {
  for (const service of [
    'caddy:',
    'server:',
    'website:',
    'admin:',
    'postgres:',
    'redis:',
  ]) {
    assert.match(compose, new RegExp(`^\\s{2}${service}`, 'm'));
  }

  assert.match(compose, /docker\/caddy\.Dockerfile/);
  assert.match(compose, /docker\/server\.Dockerfile/);
  assert.match(compose, /docker\/website\.Dockerfile/);
  assert.match(compose, /docker\/admin\.Dockerfile/);
});

test('docker compose wires cross-container control endpoints', () => {
  assert.match(compose, /VANBLOG_CADDY_API_URL:\s+http:\/\/caddy:2019/);
  assert.match(compose, /VANBLOG_WEBSITE_CONTROL_URL:\s+http:\/\/website:3011/);
  assert.match(compose, /VAN_BLOG_DATABASE_URL:\s+\$\{VAN_BLOG_DATABASE_URL:-postgresql:\/\//);
  assert.match(compose, /VAN_BLOG_REDIS_URL:\s+\$\{VAN_BLOG_REDIS_URL:-redis:\/\/redis:6379\}/);
  assert.match(compose, /VANBLOG_WEBSITE_ISR_BASE:\s+http:\/\/website:3001\/api\/revalidate\?path=/);
});

test('caddy routes requests to the split services', () => {
  assert.match(caddyfile, /http:\/\/ \{/);
  assert.match(caddyfile, /reverse_proxy server:3000/);
  assert.match(caddyfile, /reverse_proxy website:3001/);
  assert.match(caddyfile, /reverse_proxy admin:3002/);
  assert.match(caddyfile, /reverse_proxy waline:8360/);
  assert.match(caddyfile, /handle \/api\/comment\*/);
  assert.match(caddyfile, /redir @adminNoSlash \/admin\/ 308/);
  assert.match(caddyfile, /rewrite \* \/admin\//);
  assert.match(caddyfile, /handle \/admin\*/);
});

test('stateful data services stay private to the compose network', () => {
  for (const service of ['postgres', 'redis']) {
    const section =
      compose.match(new RegExp(`\\n  ${service}:\\n([\\s\\S]*?)(?:\\n  [a-z][a-z0-9_-]*:|\\n$)`, 'i'))?.[1] ??
      '';
    assert.ok(section.length > 0, `expected to find the ${service} service block`);
    assert.doesNotMatch(section, /\n\s+ports:\s*\n/);
    assert.match(section, /healthcheck:/);
  }
});

test('caddy admin API stays private to the compose network', () => {
  const caddySection = compose.match(/\n  caddy:\n([\s\S]*?)(?:\n  [a-z][a-z0-9_-]*:|\n$)/i)?.[1] ?? '';
  assert.ok(caddySection.length > 0, 'expected to find the caddy service block');
  assert.match(caddyfile, /admin 0\.0\.0\.0:2019/);
  assert.doesNotMatch(caddySection, /2019:2019/);
  assert.doesNotMatch(caddySection, /VANBLOG_CADDY_ADMIN_PORT/);
});
