import { DETECTORS, buildIndex } from "../detectors/index.js";
import type { Detector } from "../detectors/detector.js";
import type { AuditResult, AuditSummary } from "../models/audit-result.js";
import type { ProjectModel } from "../models/project-model.js";
import { auditExitCode } from "./exit-codes.js";

export interface AuditOptions {
  strict: boolean;
  /** Restrict the audit to specific detector ids (e.g. `--only missing`). */
  only?: readonly string[];
}

/**
 * The audit engine is fully format-agnostic: it takes a `ProjectModel` and
 * returns an `AuditResult`. Detectors run in a stable order and their findings
 * are aggregated; the exit code is derived from severity (and `strict`).
 */
export function runAudit(model: ProjectModel, options: AuditOptions): AuditResult {
  const index = buildIndex(model);

  const detectors: readonly Detector[] =
    options.only && options.only.length > 0
      ? DETECTORS.filter((d) => options.only!.includes(d.id))
      : DETECTORS;

  const findings = detectors.flatMap((d) => d.detect(index));

  const summary: AuditSummary = {
    filesScanned: model.allFiles.length,
    variablesFound: distinctVariableCount(model),
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
    total: findings.length,
  };

  const exitCode = auditExitCode({ findings, strict: options.strict });

  return { findings, summary, exitCode };
}

function distinctVariableCount(model: ProjectModel): number {
  const names = new Set<string>();
  for (const file of model.allFiles) {
    for (const v of file.variables) names.add(v.name);
    for (const v of file.usages) names.add(v.name);
  }
  return names.size;
}

/** True when a name is defined (has a value) in at least one environment file. */
export function isDefinedInAnyEnv(model: ProjectModel, name: string): boolean {
  return model.envFiles.some((file) => file.variables.some((v) => v.name === name));
}

/** True when a name is documented in `.env.example`. */
export function isDocumented(model: ProjectModel, name: string): boolean {
  return model.envFiles.some(
    (file) => file.environment === "example" && file.variables.some((v) => v.name === name),
  );
}
