import fg from "fast-glob";
import type { EnvdoctorConfig } from "../config/config.js";
import type { Parser, ParserRegistry } from "../parsers/parser.js";
import { parserForPath } from "../parsers/parser.js";

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
];

/**
 * Discover every file in the project that any parser claims, using the
 * config's glob patterns. Respects node_modules/`dist`/etc. and the user's
 * `ignoreFiles`.
 */
export async function discoverFiles(
  rootDir: string,
  config: EnvdoctorConfig,
  registry: ParserRegistry,
): Promise<DiscoveredFile[]> {
  const sourceExts = config.sourceExtensions
    .map((ext) => ext.replace(/^\./, ""))
    .join(",");
  const patterns = [
    ...config.envFilePatterns,
    ...config.composeFilePatterns,
    ...config.actionsFilePatterns,
    `**/*.{${sourceExts}}`,
  ];

  const matched = await fg(patterns, {
    cwd: rootDir,
    dot: true,
    absolute: true,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    ignore: [...ALWAYS_IGNORED, ...config.ignoreFiles],
  });

  const discovered: DiscoveredFile[] = [];
  for (const filePath of matched) {
    const parser = parserForPath(registry, filePath);
    if (!parser) continue;
    discovered.push({ filePath, parser });
  }
  return discovered;
}
