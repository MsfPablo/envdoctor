import path from "node:path";
import { fileURLToPath } from "node:url";

/** Convert a possibly-URL module path to a plain filesystem path. */
export const filePathOf = (p: string): string =>
  p.startsWith("file:") ? fileURLToPath(p) : p;

/**
 * Render a path relative to the project root when possible, falling back to
 * the absolute path. Used for every path shown to the user so output reads
 * like `src/index.ts:12` instead of a full absolute path.
 */
export function displayPath(rootDir: string, filePath: string): string {
  const rel = path.relative(rootDir, filePath);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return filePath;
  }
  return rel;
}

/** Join paths with platform separators, normalizing to forward slashes. */
export function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}
