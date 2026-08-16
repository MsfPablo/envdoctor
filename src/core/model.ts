import fs from "node:fs/promises";
import path from "node:path";
import type { EnvdoctorConfig } from "../config/config.js";
import type { EnvironmentFile } from "../models/environment-file.js";
import type { ProjectModel } from "../models/project-model.js";
import { matchesAnyGlob } from "../utils/glob.js";
import type { DiscoveredFile } from "./discover.js";

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * Read every discovered file and parse it into envdoctor's normalized model.
 * Unreadable or unparseable files are recorded in `parseErrors` rather than
 * aborting the whole scan — a single broken file shouldn't hide everything
 * else.
 */
export async function assembleModel(
  rootDir: string,
  config: EnvdoctorConfig,
  discovered: DiscoveredFile[],
): Promise<ProjectModel> {
  const envFiles: EnvironmentFile[] = [];
  const composeFiles: EnvironmentFile[] = [];
  const actionFiles: EnvironmentFile[] = [];
  const k8sFiles: EnvironmentFile[] = [];
  const sourceFiles: EnvironmentFile[] = [];
  const parseErrors: { filePath: string; error: string }[] = [];

  for (const { filePath, parser } of discovered) {
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch (err) {
      parseErrors.push({ filePath, error: `cannot read: ${errorMessage(err)}` });
      continue;
    }

    let parsed: EnvironmentFile;
    try {
      parsed = parser.parse(content, filePath);
    } catch (err) {
      parseErrors.push({ filePath, error: `parse failed: ${errorMessage(err)}` });
      continue;
    }

    switch (parsed.format) {
      case "dotenv":
        envFiles.push(parsed);
        break;
      case "docker-compose":
        composeFiles.push(parsed);
        break;
      case "github-actions":
        actionFiles.push(parsed);
        break;
      case "kubernetes":
        k8sFiles.push(parsed);
        break;
      case "source":
        sourceFiles.push(parsed);
        break;
    }
  }

  applyIgnoreVariables(envFiles, config);
  applyIgnoreVariables(composeFiles, config);
  applyIgnoreVariables(actionFiles, config);
  applyIgnoreVariables(k8sFiles, config);
  applyIgnoreVariables(sourceFiles, config);

  applyEnvironmentOverrides(envFiles, rootDir, config);

  const allFiles = [...envFiles, ...composeFiles, ...actionFiles, ...k8sFiles, ...sourceFiles];

  return {
    rootDir,
    config,
    envFiles,
    composeFiles,
    actionFiles,
    k8sFiles,
    sourceFiles,
    allFiles,
    parseErrors,
  };
}

/** Drop variables whose names match `ignoreVariables` from a set of files. */
function applyIgnoreVariables(files: EnvironmentFile[], config: EnvdoctorConfig): void {
  if (config.ignoreVariables.length === 0) return;
  for (const file of files) {
    file.variables = file.variables.filter(
      (v) => !matchesAnyGlob(config.ignoreVariables, v.name),
    );
    file.usages = file.usages.filter(
      (v) => !matchesAnyGlob(config.ignoreVariables, v.name),
    );
  }
}

/** Re-tag env files with explicit environment labels from the config. */
function applyEnvironmentOverrides(
  envFiles: EnvironmentFile[],
  rootDir: string,
  config: EnvdoctorConfig,
): void {
  if (!config.environments) return;
  for (const file of envFiles) {
    const rel = path.relative(rootDir, file.filePath);
    for (const [label, patterns] of Object.entries(config.environments)) {
      if (matchesAnyGlob(patterns, rel)) {
        file.environment = label;
        const retag = (v: { origins: { environment?: string }[] }) =>
          v.origins.forEach((o) => {
            o.environment = label;
          });
        file.variables.forEach(retag);
        file.usages.forEach(retag);
        break;
      }
    }
  }
}
