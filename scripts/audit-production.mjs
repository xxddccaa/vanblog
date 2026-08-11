import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const walinePaths = [resolve(root, "packages/waline")];
const patchPath = resolve(root, "patches/@waline__vercel@1.41.4.patch");
const removedWalineDependencies = [
  "@cloudbase/node-sdk",
  "akismet",
  "leancloud-storage",
];

const assertWalinePatchIsEffective = () => {
  if (!existsSync(patchPath)) {
    throw new Error("缺少 Waline 生产依赖裁剪补丁");
  }
  const patch = readFileSync(patchPath, "utf8");
  for (const dependency of removedWalineDependencies) {
    const escapedDependency = dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`^-\\s+"${escapedDependency}":`, "m").test(patch)) {
      throw new Error(`Waline 补丁未移除依赖: ${dependency}`);
    }
    try {
      require.resolve(dependency, { paths: walinePaths });
      throw new Error(`已禁用的 Waline 依赖仍可在生产工作区解析: ${dependency}`);
    } catch (error) {
      if (!String(error?.message).includes("Cannot find module")) {
        throw error;
      }
    }
  }
};

const result = spawnSync("pnpm", ["audit", "--prod", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

if (!result.stdout.trim()) {
  process.stderr.write(result.stderr || "pnpm audit 未返回 JSON\n");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  process.stderr.write(result.stdout);
  process.stderr.write(result.stderr || "");
  throw error;
}

assertWalinePatchIsEffective();

const ignoredPrefixes = [
  "packages__waline>@waline/vercel>akismet>",
  "packages__waline>@waline/vercel>@cloudbase/node-sdk>",
];
const reachable = [];
let ignored = 0;

for (const advisory of Object.values(report.advisories || {})) {
  for (const finding of advisory.findings || []) {
    for (const dependencyPath of finding.paths || []) {
      if (ignoredPrefixes.some((prefix) => dependencyPath.startsWith(prefix))) {
        ignored += 1;
        continue;
      }
      reachable.push({
        severity: advisory.severity,
        module: advisory.module_name,
        version: finding.version,
        dependencyPath,
        advisory: advisory.github_advisory_id || advisory.id,
      });
    }
  }
}

if (reachable.length > 0) {
  console.error(`发现 ${reachable.length} 条仍可达的生产依赖漏洞路径：`);
  for (const item of reachable) {
    console.error(
      `${item.severity}\t${item.module}@${item.version}\t${item.advisory}\t${item.dependencyPath}`,
    );
  }
  process.exit(1);
}

console.log(
  `生产依赖审计通过：无可达漏洞；忽略 ${ignored} 条已由 Waline 补丁物理移除的上游锁文件残留路径。`,
);
