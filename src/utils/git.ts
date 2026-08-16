import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface GitFilter {
  since?: string;
  staged?: boolean;
}

function gitTopLevel(cwd: string): string | undefined {
  try {
    const raw = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
    return fs.realpathSync(raw);
  } catch {
    return undefined;
  }
}

function addResolvedPaths(topLevel: string, stdout: string, files: Set<string>): void {
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    files.add(fs.realpathSync(path.resolve(topLevel, trimmed)));
  }
}

function changedFiles(cwd: string, args: string[], includeUntracked = false): Set<string> | undefined {
  const topLevel = gitTopLevel(cwd);
  if (!topLevel) return undefined;
  try {
    const stdout = execFileSync("git", ["-C", topLevel, "diff", "--name-only", ...args], {
      encoding: "utf8",
    });
    const files = new Set<string>();
    addResolvedPaths(topLevel, stdout, files);
    if (includeUntracked) {
      try {
        const untracked = execFileSync("git", ["-C", topLevel, "ls-files", "--others", "--exclude-standard"], {
          encoding: "utf8",
        });
        addResolvedPaths(topLevel, untracked, files);
      } catch {
        // ignore
      }
    }
    return files;
  } catch {
    return undefined;
  }
}

/** Return absolute paths of files changed since `ref`, including untracked files. */
export function changedFilesSince(cwd: string, ref: string): Set<string> | undefined {
  return changedFiles(cwd, [ref], true);
}

/** Return absolute paths of files staged for commit. */
export function stagedFiles(cwd: string): Set<string> | undefined {
  return changedFiles(cwd, ["--cached"], false);
}

/** True when git-aware filtering is active but no git changes were found. */
export function hasNoGitChanges(cwd: string, filter: GitFilter): boolean {
  if (filter.staged) {
    const files = stagedFiles(cwd);
    return files !== undefined && files.size === 0;
  }
  if (filter.since) {
    const files = changedFilesSince(cwd, filter.since);
    return files !== undefined && files.size === 0;
  }
  return false;
}
