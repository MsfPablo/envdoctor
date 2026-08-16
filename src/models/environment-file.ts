import type { EnvironmentVariable } from "./environment-variable.js";

export type FileFormat = "dotenv" | "docker-compose" | "github-actions" | "source";

/**
 * The parsed contents of a single file, normalized to envdoctor's model.
 *
 * - `variables`: names defined (or referenced with a value) in this file.
 * - `usages`: names read in this file without a value (source `process.env.X`,
 *   `${VAR}` interpolation, `${{ secrets.X }}`).
 *
 * Both lists are flattened — every name observed in the file appears in
 * exactly one of them.
 */
export interface EnvironmentFile {
  /** Path the file was read from. */
  filePath: string;
  format: FileFormat;
  /** Environment label for dotenv files ("development", "production", ...). */
  environment?: string;
  variables: EnvironmentVariable[];
  usages: EnvironmentVariable[];
}

/** Names defined in a file, deduplicated, in first-seen order. */
export const definedNames = (file: EnvironmentFile): string[] =>
  Array.from(new Set(file.variables.map((v) => v.name)));

/** Names used in a file, deduplicated, in first-seen order. */
export const usedNames = (file: EnvironmentFile): string[] =>
  Array.from(new Set(file.usages.map((v) => v.name)));
