import { DETECTORS } from "../detectors/index.js";
import { runAudit } from "../core/audit.js";
import { loadProject } from "../core/pipeline.js";
import { renderReport, ui } from "../utils/logger.js";
import { originToJson, reportParseErrors } from "./shared.js";

export interface ScanOptions {
  rootDir: string;
  strict: boolean;
  json: boolean;
  verbose: boolean;
  /** Detector ids to restrict the audit to (from `--only`). */
  only: string[];
}

/** `envdoctor scan` — discover, parse, audit, and report. */
export async function runScan(opts: ScanOptions): Promise<number> {
  const knownRules = new Set(DETECTORS.map((d) => d.id));
  for (const rule of opts.only) {
    if (!knownRules.has(rule)) {
      process.stderr.write(
        `${ui.warning("warning")} Unknown detector "${rule}" (known: ${Array.from(knownRules).join(", ")})\n`,
      );
    }
  }

  const context = await loadProject(opts.rootDir);
  const audit = runAudit(context.model, { strict: opts.strict, only: opts.only });

  reportParseErrors(context.model, opts.rootDir);

  if (opts.json) {
    process.stdout.write(JSON.stringify(toJson(audit, context.rootDir), null, 2) + "\n");
  } else {
    process.stdout.write(renderReport(audit, { rootDir: opts.rootDir, verbose: opts.verbose }) + "\n");
  }

  return audit.exitCode;
}

interface JsonFinding {
  id: string;
  ruleId: string;
  severity: string;
  variable: string;
  message: string;
  locations: { file: string; line?: number; kind: string }[];
}

function toJson(
  audit: ReturnType<typeof runAudit>,
  rootDir: string,
): {
  exitCode: number;
  summary: typeof audit.summary;
  findings: JsonFinding[];
} {
  return {
    exitCode: audit.exitCode,
    summary: audit.summary,
    findings: audit.findings.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      severity: f.severity,
      variable: f.variable,
      message: f.message,
      locations: f.locations.map((o) => originToJson(rootDir, o)),
    })),
  };
}
