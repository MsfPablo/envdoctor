import fs from "node:fs";
import path from "node:path";
import { DETECTORS } from "../detectors/index.js";
import { runAudit } from "../core/audit.js";
import { loadProject } from "../core/pipeline.js";
import { formatSarif } from "../formatters/sarif.js";
import { renderReport, ui } from "../utils/logger.js";
import { displayPath } from "../utils/paths.js";
import { originToJson, reportParseErrors } from "./shared.js";
import type { Finding } from "../models/audit-result.js";

export type OutputFormat = "human" | "json" | "sarif";

export interface ScanOptions {
  rootDir: string;
  strict: boolean;
  /** Output format. */
  format: OutputFormat;
  verbose: boolean;
  /** Detector ids to restrict the audit to (from `--only`). */
  only: string[];
  /** Path to a baseline file; matching known findings are suppressed. */
  baseline?: string;
  /** Path to write a new baseline from the current findings. */
  writeBaseline?: string;
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
  let audit = runAudit(context.model, {
    strict: opts.strict,
    only: opts.only,
    rules: context.config.rules,
  });

  reportParseErrors(context.model, opts.rootDir);

  if (opts.baseline) {
    audit = applyBaseline(audit, opts.baseline, opts.rootDir, opts.strict);
  }

  if (opts.writeBaseline) {
    writeBaseline(audit, opts.writeBaseline, opts.rootDir);
  }

  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(toJson(audit, context.rootDir), null, 2) + "\n");
  } else if (opts.format === "sarif") {
    process.stdout.write(formatSarif(audit, context.rootDir) + "\n");
  } else {
    process.stdout.write(renderReport(audit, { rootDir: opts.rootDir, verbose: opts.verbose }) + "\n");
  }

  return audit.exitCode;
}

interface BaselineEntry {
  ruleId: string;
  variable: string;
  files: string[];
}

interface BaselineFile {
  version: number;
  findings: BaselineEntry[];
}

function fingerprint(finding: Finding, rootDir: string): BaselineEntry {
  const files = Array.from(
    new Set(finding.locations.map((o) => displayPath(rootDir, o.filePath))),
  ).sort();
  return { ruleId: finding.ruleId, variable: finding.variable, files };
}

function entryMatches(a: BaselineEntry, b: BaselineEntry): boolean {
  if (a.ruleId !== b.ruleId || a.variable !== b.variable) return false;
  if (a.files.length !== b.files.length) return false;
  for (let i = 0; i < a.files.length; i++) {
    if (a.files[i] !== b.files[i]) return false;
  }
  return true;
}

function applyBaseline(
  audit: ReturnType<typeof runAudit>,
  baselinePath: string,
  rootDir: string,
  strict: boolean,
): ReturnType<typeof runAudit> {
  const fullPath = path.resolve(rootDir, baselinePath);
  let baseline: BaselineFile;
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    baseline = JSON.parse(raw) as BaselineFile;
  } catch (err) {
    process.stderr.write(
      `${ui.warning("warning")} Could not read baseline ${baselinePath}: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    return audit;
  }

  const before = audit.findings.length;
  const findings = audit.findings.filter((f) => {
    const fp = fingerprint(f, rootDir);
    return !baseline.findings.some((b) => entryMatches(b, fp));
  });
  const suppressed = before - findings.length;
  if (suppressed > 0) {
    process.stderr.write(
      `${ui.info("info")} ${suppressed} finding${suppressed === 1 ? "" : "s"} suppressed by baseline\n`,
    );
  }

  return recomputeAudit(audit, findings, strict);
}

function recomputeAudit(
  audit: ReturnType<typeof runAudit>,
  findings: Finding[],
  strict: boolean,
): ReturnType<typeof runAudit> {
  const summary = {
    filesScanned: audit.summary.filesScanned,
    variablesFound: audit.summary.variablesFound,
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
    total: findings.length,
  };
  const exitCode = summary.errors > 0 || (strict && summary.warnings > 0) ? 1 : 0;
  return { findings, summary, exitCode };
}

function writeBaseline(
  audit: ReturnType<typeof runAudit>,
  baselinePath: string,
  rootDir: string,
): void {
  const fullPath = path.resolve(rootDir, baselinePath);
  const baseline: BaselineFile = {
    version: 1,
    findings: audit.findings.map((f) => fingerprint(f, rootDir)),
  };
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(baseline, null, 2) + "\n");
  process.stderr.write(`${ui.info("info")} Wrote baseline to ${baselinePath}\n`);
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
