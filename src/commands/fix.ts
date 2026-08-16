import fs from "node:fs";
import path from "node:path";
import { runAudit } from "../core/audit.js";
import { loadProject } from "../core/pipeline.js";
import { generateEnvExample } from "../generators/env-example.js";
import { generateEnvTypes } from "../generators/env-types.js";
import { generateEnvironmentDoc } from "../generators/environment-doc.js";
import {
  collectActionsChecklist,
  generateActionsChecklist,
} from "../generators/github-actions.js";
import { ui } from "../utils/logger.js";

export interface FixOptions {
  rootDir: string;
  dryRun: boolean;
  force: boolean;
  verbose: boolean;
}

interface PlannedFile {
  relPath: string;
  action: "create" | "update" | "skip";
  content: string;
}

/**
 * `envdoctor fix` — run the audit, then regenerate the safe, generated
 * artifacts: `.env.example`, `ENVIRONMENT.md`, and (when the project uses
 * GitHub Actions secrets/vars) `.github/ENVIRONMENT.md`. Never touches real
 * `.env` files and never writes secret values. `--dry-run` previews changes.
 */
export async function runFix(opts: FixOptions): Promise<number> {
  const context = await loadProject(opts.rootDir);
  const audit = runAudit(context.model, { strict: false, rules: context.config.rules });

  const checklist = collectActionsChecklist(context.model);
  const hasActionsRefs = checklist.secrets.length > 0 || checklist.vars.length > 0;

  const plans: PlannedFile[] = [
    plan(".env.example", generateEnvExample(context.model), opts),
    plan("ENVIRONMENT.md", generateEnvironmentDoc(context.model), opts),
    plan("env.d.ts", generateEnvTypes(context.model), opts),
  ];
  if (hasActionsRefs) {
    plans.push(plan(path.join(".github", "ENVIRONMENT.md"), generateActionsChecklist(context.model), opts));
  }

  if (opts.dryRun) {
    process.stdout.write(ui.title("envdoctor fix (dry run)") + "\n\n");
    for (const plan of plans) {
      const marker =
        plan.action === "create" ? ui.success("+") : plan.action === "update" ? ui.warning("~") : ui.dim("·");
      process.stdout.write(`  ${marker} ${ui.name(plan.relPath)}  ${ui.dim(actionLabel(plan.action))}\n`);
    }
    const pending = plans.filter((p) => p.action !== "skip").length;
    process.stdout.write(`\n  ${pending} change${pending === 1 ? "" : "s"} planned\n`);
    return audit.exitCode;
  }

  let created = 0;
  let updated = 0;
  for (const plan of plans) {
    if (plan.action === "skip") continue;
    const full = path.join(opts.rootDir, plan.relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, plan.content);
    if (plan.action === "create") created++;
    else updated++;
  }

  process.stdout.write(ui.title("envdoctor fix") + "\n\n");
  for (const plan of plans) {
    if (plan.action === "skip") {
      process.stdout.write(`  ${ui.dim("·")} skipped ${ui.name(plan.relPath)} (exists; use --force to overwrite)\n`);
    } else {
      process.stdout.write(
        `  ${ui.success("✓")} ${plan.action === "create" ? "created" : "updated"} ${ui.name(plan.relPath)}\n`,
      );
    }
  }
  process.stdout.write(
    `\n  ${created} created, ${updated} updated · ${audit.summary.errors} error${audit.summary.errors === 1 ? "" : "s"} still present\n`,
  );

  return audit.exitCode;
}

function plan(relPath: string, content: string, opts: FixOptions): PlannedFile {
  const exists = fs.existsSync(path.join(opts.rootDir, relPath));
  if (!exists) return { relPath, action: "create", content };
  if (opts.force) return { relPath, action: "update", content };
  return { relPath, action: "skip", content };
}

function actionLabel(action: PlannedFile["action"]): string {
  if (action === "create") return "will create";
  if (action === "update") return "will update";
  return "exists";
}
