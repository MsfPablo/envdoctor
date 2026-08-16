import fs from "node:fs";
import path from "node:path";
import { generateEnvExample } from "../generators/env-example.js";
import { generateEnvironmentDoc } from "../generators/environment-doc.js";
import { loadProject } from "../core/pipeline.js";
import { ui } from "../utils/logger.js";

export interface InitOptions {
  rootDir: string;
  force: boolean;
}

const CONFIG_TEMPLATE = `// envdoctor configuration (optional).
// See https://github.com/you/envdoctor for the full reference.
export default {
  // Glob patterns for dotenv files.
  // envFilePatterns: [".env", ".env.*"],
  // File extensions scanned for process.env usage.
  // sourceExtensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs"],
  // Variable names to never report (globs supported).
  // ignoreVariables: ["AWS_*"],
  // Fail the audit on warnings too.
  // strict: false,
};
`;

const CONFIG_BASENAME = "envdoctor.config.mjs";

/**
 * `envdoctor init` — bootstrap envdoctor for a project. Non-destructive:
 * existing files are only overwritten with `--force`.
 */
export async function runInit(opts: InitOptions): Promise<number> {
  const context = await loadProject(opts.rootDir);

  const created: string[] = [];
  const skipped: string[] = [];

  const writeIfAbsent = (relPath: string, content: string) => {
    const full = path.join(opts.rootDir, relPath);
    if (fs.existsSync(full) && !opts.force) {
      skipped.push(relPath);
      return;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    created.push(relPath);
  };

  writeIfAbsent(CONFIG_BASENAME, CONFIG_TEMPLATE);
  writeIfAbsent(".env.example", generateEnvExample(context.model));
  writeIfAbsent("ENVIRONMENT.md", generateEnvironmentDoc(context.model));

  process.stdout.write(ui.title("envdoctor init") + "\n\n");
  for (const rel of created) {
    process.stdout.write(`  ${ui.success("✓")} created ${ui.name(rel)}\n`);
  }
  for (const rel of skipped) {
    process.stdout.write(`  ${ui.dim("·")} exists, skipped ${ui.name(rel)} (use --force to overwrite)\n`);
  }
  process.stdout.write(
    `\n  ${created.length} created, ${skipped.length} skipped\n`,
  );

  return 0;
}
