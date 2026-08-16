import { DETECTORS, buildIndex } from "../detectors/index.js";
import type { Detector } from "../detectors/detector.js";
import type { AuditResult, AuditSummary, Finding } from "../models/audit-result.js";
import type { ProjectModel } from "../models/project-model.js";
import { auditExitCode } from "./exit-codes.js";

export interface AuditOptions {
  strict: boolean;
  /** Restrict the audit to specific detector ids (e.g. `--only missing`). */
  only?: readonly string[];
  /** Per-detector severity overrides. */
  rules?: Record<string, "error" | "warning" | "off">;
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

  let findings = detectors.flatMap((d) => d.detect(index));

  findings = applyIgnores(findings, model);
  findings = applyRuleSeverities(findings, options.rules ?? {});

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

/** Build a map of variable name → set of ignored rule ids from inline comments. */
function buildIgnoredRulesByName(model: ProjectModel): Map<string, Set<string>> {
  const ignored = new Map<string, Set<string>>();
  for (const file of model.envFiles) {
    if (file.environment === "example") continue;
    for (const v of file.variables) {
      if (!v.ignoreRules || v.ignoreRules.length === 0) continue;
      const set = ignored.get(v.name) ?? new Set<string>();
      for (const rule of v.ignoreRules) set.add(rule);
      ignored.set(v.name, set);
    }
  }
  return ignored;
}

/** Drop findings that are ignored inline in env files. */
function applyIgnores(
  findings: Finding[],
  model: ProjectModel,
): Finding[] {
  const ignored = buildIgnoredRulesByName(model);
  return findings.filter((f) => {
    const rules = ignored.get(f.variable);
    return !(rules && rules.has(f.ruleId));
  });
}

/** Apply per-detector severity overrides from config. Disabled rules are dropped. */
function applyRuleSeverities(
  findings: Finding[],
  rules: Record<string, "error" | "warning" | "off">,
): Finding[] {
  const result: Finding[] = [];
  for (const f of findings) {
    const override = rules[f.ruleId];
    if (override === "off") continue;
    if (override) result.push({ ...f, severity: override });
    else result.push(f);
  }
  return result;
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
