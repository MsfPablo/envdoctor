import { compareEnvironments } from "../detectors/environment-diff.js";
import { loadProject } from "../core/pipeline.js";
import { rule, ui } from "../utils/logger.js";
import { normalizeEnvLabel, reportParseErrors } from "./shared.js";

export interface DiffOptions {
  rootDir: string;
  envA: string;
  envB: string;
  json: boolean;
}

/** `envdoctor diff <env1> <env2>` — compare variable sets across environments. */
export async function runDiff(opts: DiffOptions): Promise<number> {
  const context = await loadProject(opts.rootDir);
  const labelA = normalizeEnvLabel(opts.envA);
  const labelB = normalizeEnvLabel(opts.envB);

  const available = new Set(
    context.model.envFiles
      .map((f) => f.environment)
      .filter((e): e is string => !!e && e !== "example"),
  );

  reportParseErrors(context.model, opts.rootDir);

  if (!available.has(labelA) || !available.has(labelB)) {
    if (!available.has(labelA)) {
      process.stderr.write(`${ui.error("error")} Environment "${labelA}" has no files in this project.\n`);
    }
    if (!available.has(labelB)) {
      process.stderr.write(`${ui.error("error")} Environment "${labelB}" has no files in this project.\n`);
    }
    process.stderr.write(`  Available: ${Array.from(available).join(", ") || "none"}\n`);
    return 2;
  }

  const entries = compareEnvironments(context.model, labelA, labelB);
  const missingCount = entries.filter((e) => !e.presentInBoth).length;

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          environments: [labelA, labelB],
          exitCode: missingCount > 0 ? 1 : 0,
          total: entries.length,
          missing: missingCount,
          variables: entries.map((e) => ({
            name: e.name,
            status: e.presentInBoth ? "same" : "missing",
            missingIn: e.presentInBoth ? null : e.presentInA ? labelB : labelA,
          })),
        },
        null,
        2,
      ) + "\n",
    );
    return missingCount > 0 ? 1 : 0;
  }

  process.stdout.write(ui.title("ENVIRONMENT DIFF") + "\n");
  process.stdout.write(`${rule("ENVIRONMENT DIFF".length * 2)}\n\n`);
  process.stdout.write(`  ${ui.bold(`${labelA} → ${labelB}`)}\n\n`);

  for (const entry of entries) {
    if (entry.presentInBoth) {
      process.stdout.write(`  ${ui.same()} ${ui.name(entry.name)}  ${ui.dim("present in both")}\n`);
    } else if (entry.presentInA) {
      process.stdout.write(`  ${ui.missing()} ${ui.name(entry.name)}  ${ui.error(`missing in ${labelB}`)}\n`);
    } else {
      process.stdout.write(`  ${ui.missing()} ${ui.name(entry.name)}  ${ui.error(`missing in ${labelA}`)}\n`);
    }
  }
  process.stdout.write(
    `\n  ${ui.dim(`Summary: ${entries.length} variables · ${missingCount} missing · ${entries.length - missingCount} present in both`)}\n`,
  );

  return missingCount > 0 ? 1 : 0;
}
