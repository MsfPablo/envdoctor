import fs from "node:fs";
import fg from "fast-glob";
import type { EnvdoctorConfig } from "../config/config.js";
import type { Parser, ParserRegistry } from "../parsers/parser.js";
import { parserForPath } from "../parsers/parser.js";
import { changedFilesSince, stagedFiles, type GitFilter } from "../utils/git.js";

/** A file that a parser claimed during discovery. */
export interface DiscoveredFile {
  /** Absolute path to the file. */
  filePath: string;
  parser: Parser;
}

const ALWAYS_IGNORED = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.venv/**",
  "**/vendor/**",
  // System / protected directories that commonly raise EPERM/EACCES when a
  // scan is run from a home directory. They never hold project env files.
  "**/.Trash/**",
  "**/Library/**",
  "**/.cache/**",
  "**/.npm/**",
];

/**
 * Discover every file in the project that any parser claims, using the
 * config's glob patterns. Respects node_modules/`dist`/etc. and the user's
 * `ignoreFiles`.
 */
export interface DiscoverOptions {
  gitFilter?: GitFilter;
}

export async function discoverFiles(
  rootDir: string,
  config: EnvdoctorConfig,
  registry: ParserRegistry,
  options: DiscoverOptions = {},
): Promise<DiscoveredFile[]> {
  const sourceExts = config.sourceExtensions
    .map((ext) => ext.replace(/^\./, ""))
    .join(",");
  const patterns = [
    ...config.envFilePatterns,
    ...config.composeFilePatterns,
    ...config.actionsFilePatterns,
    ...config.k8sFilePatterns,
    `**/*.{${sourceExts}}`,
  ];

  const matched = await fg(patterns, {
    cwd: rootDir,
    dot: true,
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    // Skip unreadable directories (e.g. macOS-protected paths) instead of
    // aborting the whole scan with EPERM/EACCES.
    suppressErrors: true,
    ignore: [...ALWAYS_IGNORED, ...config.ignoreFiles],
  });

  let changedFiles: Set<string> | undefined;
  if (options.gitFilter?.since) {
    changedFiles = changedFilesSince(rootDir, options.gitFilter.since);
  } else if (options.gitFilter?.staged) {
    changedFiles = stagedFiles(rootDir);
  }

  const discovered: DiscoveredFile[] = [];
  for (const rawPath of matched) {
    const filePath = fs.realpathSync(rawPath);
    if (changedFiles && !changedFiles.has(filePath)) continue;
    const parser = parserForPath(registry, filePath);
    if (!parser) continue;
    discovered.push({ filePath, parser });
  }
  return discovered;
}
