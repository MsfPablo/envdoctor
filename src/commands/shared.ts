import fs from "node:fs";
import path from "node:path";
import type { ProjectModel } from "../models/project-model.js";
import type { Origin } from "../models/origin.js";
import { displayPath } from "../utils/paths.js";
import { ui } from "../utils/logger.js";

/** Resolve a `--dir` argument to an absolute path and validate it. */
export function resolveRootDir(input: string | undefined): string {
  const dir = path.resolve(input ?? process.cwd());
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }
  return dir;
}

/** Report files that could not be parsed, without failing the command. */
export function reportParseErrors(model: ProjectModel, rootDir: string): void {
  for (const pe of model.parseErrors) {
    process.stderr.write(
      `${ui.warning("⚠")} ${ui.location(displayPath(rootDir, pe.filePath))}: ${pe.error}\n`,
    );
  }
}

/** Serialize an origin for JSON output (values never appear). */
export function originToJson(rootDir: string, origin: Origin): { file: string; line?: number; kind: string } {
  return {
    file: displayPath(rootDir, origin.filePath),
    line: origin.line,
    kind: origin.kind,
  };
}

/** The normalized environment label for a user-supplied diff argument. */
export function normalizeEnvLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed === "dev") return "development";
  if (trimmed === "prod") return "production";
  return trimmed;
}
