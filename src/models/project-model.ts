import type { EnvironmentFile } from "./environment-file.js";
import type { EnvironmentVariable } from "./environment-variable.js";
import type { Origin } from "./origin.js";

/**
 * The fully assembled, format-agnostic view of a project, produced by
 * `core/model.ts` from discovered and parsed files. This is the single input
 * to the audit engine — detectors never look at raw file formats.
 */
export interface ProjectModel {
  /** The project root the model was built from. */
  rootDir: string;
  /** Parsed `.env*` files, each tagged with an environment label. */
  envFiles: EnvironmentFile[];
  /** Parsed docker-compose files. */
  composeFiles: EnvironmentFile[];
  /** Parsed GitHub Actions workflow files. */
  actionFiles: EnvironmentFile[];
  /** Source code files scanned for `process.env` / `import.meta.env` usage. */
  sourceFiles: EnvironmentFile[];
  /** Every file that was scanned, in any format. */
  allFiles: EnvironmentFile[];
  /** Files that matched a parser but failed to parse (kept for reporting). */
  parseErrors: { filePath: string; error: string }[];
}

/** All definitions (variables with values) across the whole project. */
export const allDefinitions = (model: ProjectModel): EnvironmentVariable[] => [
  ...model.envFiles.flatMap((f) => f.variables),
  ...model.composeFiles.flatMap((f) => f.variables),
  ...model.actionFiles.flatMap((f) => f.variables),
];

/** All usages (name references without values) across the whole project. */
export const allUsages = (model: ProjectModel): EnvironmentVariable[] => [
  ...model.envFiles.flatMap((f) => f.usages),
  ...model.composeFiles.flatMap((f) => f.usages),
  ...model.actionFiles.flatMap((f) => f.usages),
  ...model.sourceFiles.flatMap((f) => f.usages),
];

/** Flatten every origin for a name into a deduplicated list. */
export const originsForName = (
  model: ProjectModel,
  name: string,
): Origin[] => {
  const seen = new Map<string, Origin>();
  const consider = (v: EnvironmentVariable) => {
    if (v.name !== name) return;
    for (const origin of v.origins) {
      const key = `${origin.filePath}:${origin.line ?? 0}:${origin.kind}`;
      if (!seen.has(key)) seen.set(key, origin);
    }
  };
  for (const file of model.allFiles) {
    file.variables.forEach(consider);
    file.usages.forEach(consider);
  }
  return Array.from(seen.values());
};
