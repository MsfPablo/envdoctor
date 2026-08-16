import type { ExitContext } from "../models/audit-result.js";

/**
 * Exit codes are part of the public contract — CI pipelines depend on them.
 *
 * - 0: audit ran and found nothing that fails
 * - 1: audit found error-severity findings (or warnings under --strict)
 * - 2: usage/config error (bad arguments, unreadable config)
 */
export const EXIT_OK = 0;
export const EXIT_ISSUES = 1;
export const EXIT_USAGE = 2;

/** Compute the exit code for an audit result given strictness. */
export function auditExitCode({ findings, strict }: ExitContext): 0 | 1 {
  const hasErrors = findings.some((f) => f.severity === "error");
  if (hasErrors) return EXIT_ISSUES;
  if (strict && findings.some((f) => f.severity === "warning")) return EXIT_ISSUES;
  return EXIT_OK;
}
