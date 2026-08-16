import fs from "node:fs";
import path from "node:path";
import { loadProject } from "../core/pipeline.js";
import { isSecretName } from "../models/environment-variable.js";
import { normalizeEnvLabel } from "./shared.js";
import { ui } from "../utils/logger.js";

export interface SyncOptions {
  rootDir: string;
  envA: string;
  envB: string;
  dryRun: boolean;
}

/**
 * `envdoctor sync <from> <to>` — copy missing variable keys from one
 * environment file to another, using placeholder values. Never copies real
 * secret values.
 */
export async function runSync(opts: SyncOptions): Promise<number> {
  const fromLabel = normalizeEnvLabel(opts.envA);
  const toLabel = normalizeEnvLabel(opts.envB);

  const context = await loadProject(opts.rootDir);
  const { model } = context;

  const fromNames = namesForEnvironment(model.envFiles, fromLabel);
  const toNames = namesForEnvironment(model.envFiles, toLabel);

  const missing = [...fromNames].filter((n) => !toNames.has(n)).sort();
  if (missing.length === 0) {
    process.stdout.write(`${ui.success("✓")} ${ui.dim(`${fromLabel} → ${toLabel}: nothing to sync`)}\n`);
    return 0;
  }

  const targetFile = targetEnvPath(opts.rootDir, toLabel, context.config);
  const targetRel = path.relative(opts.rootDir, targetFile);

  const lines: string[] = [];
  lines.push("");
  lines.push(`# Synced from ${fromLabel} by envdoctor`);
  for (const name of missing) {
    const placeholder = isSecretName(name) ? "" : `your_${name.toLowerCase()}`;
    lines.push(`${name}=${placeholder}`);
  }
  const append = lines.join("\n") + "\n";

  if (opts.dryRun) {
    process.stdout.write(ui.title(`envdoctor sync (dry run)`) + "\n\n");
    process.stdout.write(`Would append ${missing.length} key${missing.length === 1 ? "" : "s"} to ${ui.name(targetRel)}:\n`);
    for (const name of missing) {
      process.stdout.write(`  ${ui.dim("+")} ${name}\n`);
    }
    return 0;
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.appendFileSync(targetFile, append);

  process.stdout.write(ui.title("envdoctor sync") + "\n\n");
  process.stdout.write(`  ${ui.success("✓")} Appended ${missing.length} key${missing.length === 1 ? "" : "s"} to ${ui.name(targetRel)}\n`);
  for (const name of missing) {
    process.stdout.write(`    ${ui.dim("+")} ${name}\n`);
  }

  return 0;
}

function namesForEnvironment(
  envFiles: Awaited<ReturnType<typeof loadProject>>["model"]["envFiles"],
  label: string,
): Set<string> {
  const names = new Set<string>();
  for (const file of envFiles) {
    if (file.environment === label) {
      for (const v of file.variables) names.add(v.name);
    }
  }
  return names;
}

function targetEnvPath(
  rootDir: string,
  label: string,
  config: Awaited<ReturnType<typeof loadProject>>["config"],
): string {
  if (config.environments?.[label]) {
    return path.resolve(rootDir, config.environments[label][0]!);
  }
  if (label === "development") return path.join(rootDir, ".env");
  return path.join(rootDir, `.env.${label}`);
}
