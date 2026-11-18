import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

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

const reachable = [];

for (const advisory of Object.values(report.advisories || {})) {
  for (const finding of advisory.findings || []) {
    for (const dependencyPath of finding.paths || []) {
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

console.log("Production dependency audit passed: no reachable vulnerabilities.");
