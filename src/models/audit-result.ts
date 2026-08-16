import type { Origin } from "./origin.js";

export type Severity = "error" | "warning" | "info";

export const SEVERITY_ORDER: Severity[] = ["error", "warning", "info"];

/**
 * A single problem found by a detector. `message` is written for humans and
 * must never contain a variable value.
 */
export interface Finding {
  /** Stable id, e.g. `missing.DATABASE_URL` or `type-mismatch.PORT`. */
  id: string;
  /** Detector id that produced this finding. */
  ruleId: string;
  severity: Severity;
  variable: string;
  message: string;
  /** Where the variable was seen; rendered as `path:line`. */
  locations: Origin[];
}

export interface AuditSummary {
  filesScanned: number;
  variablesFound: number;
  errors: number;
  warnings: number;
  infos: number;
  total: number;
}

export interface AuditResult {
  findings: Finding[];
  summary: AuditSummary;
  /** 0 = clean, 1 = errors, (2 is reserved for usage/config errors). */
  exitCode: 0 | 1;
}

export interface ExitContext {
  findings: Finding[];
  strict: boolean;
}

export type AuditFailureKind = "none" | "errors" | "warnings" | "usage-error";
