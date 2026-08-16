import { loadConfig, type EnvdoctorConfig } from "../config/config.js";
import type { ProjectModel } from "../models/project-model.js";
import { defaultRegistry } from "../parsers/registry.js";
import type { GitFilter } from "../utils/git.js";
import { assembleModel } from "./model.js";
import { discoverFiles } from "./discover.js";

export interface ProjectContext {
  rootDir: string;
  config: EnvdoctorConfig;
  model: ProjectModel;
}

export interface LoadProjectOptions {
  gitFilter?: GitFilter;
}

/**
 * The standard pipeline every command uses: load config → build parsers →
 * discover files → assemble the normalized model.
 */
export async function loadProject(
  rootDir: string,
  options: LoadProjectOptions = {},
): Promise<ProjectContext> {
  const config = await loadConfig(rootDir);
  const registry = defaultRegistry({ sourceExtensions: config.sourceExtensions });
  const discovered = await discoverFiles(rootDir, config, registry, { gitFilter: options.gitFilter });
  const model = await assembleModel(rootDir, config, discovered);
  return { rootDir, config, model };
}
