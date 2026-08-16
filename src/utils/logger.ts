import chalk from "chalk";
import type { AuditResult, Finding, Severity } from "../models/audit-result.js";
import type { Origin } from "../models/origin.js";
import { displayPath } from "./paths.js";

/**
 * Thin styling helpers over chalk. Everything the CLI prints goes through this
 * module so output is consistent and, if we ever need to, easy to redirect.
 *
 * Values are never rendered anywhere in this module — callers only ever pass
 * variable names, types, and locations.
 */
export const ui = {
  title: (s: string) => chalk.bold.underline(s),
  bold: (s: string) => chalk.bold(s),
  rule: (s: string) => chalk.dim(s),
  section: (s: string) => chalk.bold(s),
  name: (s: string) => s,
  location: (s: string) => chalk.cyan(s),
  error: (s: string) => chalk.red(s),
  warning: (s: string) => chalk.yellow(s),
  info: (s: string) => chalk.cyan(s),
  success: (s: string) => chalk.green(s),
  dim: (s: string) => chalk.dim(s),
  missing: () => chalk.red("❌"),
  different: () => chalk.yellow("⚠"),
  same: () => chalk.green("✓"),
};

export const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
  error: ui.error,
  warning: ui.warning,
  info: ui.info,
};

/** Render a horizontal rule the width of the given string. */
export function rule(width: number): string {
  return "─".repeat(Math.max(width, 0));
}

/** Render a single location as `relative/path:line`. */
export function renderLocation(rootDir: string, origin: Origin): string {
  const path = displayPath(rootDir, origin.filePath);
  return origin.line ? `${path}:${origin.line}` : path;
}

export interface ReportOptions {
  rootDir: string;
  verbose: boolean;
}

/** A single block in the report, rendered from findings sharing a rule. */
interface SectionSpec {
  heading: string;
  severity: Severity;
  ruleIds: string[];
  /** Render one finding. */
  line: (finding: Finding, rootDir: string, verbose: boolean) => string[];
}

const locationLines = (finding: Finding, rootDir: string, verbose: boolean): string[] => {
  if (!verbose || finding.locations.length === 0) return [];
  const shown = finding.locations.slice(0, 3);
  return shown.map((o) => `  ${ui.dim("·")} ${ui.location(renderLocation(rootDir, o))}`);
};

const SECTION_SPECS: SectionSpec[] = [
  {
    heading: "Missing",
    severity: "error",
    ruleIds: ["missing", "undefined-in-source"],
    line: (f, rootDir, verbose) => {
      const where =
        f.locations.length > 0
          ? ui.dim(`referenced in ${f.locations.map((o) => renderLocation(rootDir, o)).join(", ")}`)
          : ui.dim("referenced but never defined");
      const lines = [`  ${f.variable}  ${where}`];
      lines.push(...locationLines(f, rootDir, verbose));
      return lines;
    },
  },
  {
    heading: "Defined but unused",
    severity: "warning",
    ruleIds: ["unused"],
    line: (f, rootDir) => {
      const where =
        f.locations.length > 0
          ? ui.dim(`defined in ${f.locations.map((o) => renderLocation(rootDir, o)).join(", ")}`)
          : "";
      return [`  ${f.variable}  ${where}`];
    },
  },
  {
    heading: "Duplicates",
    severity: "warning",
    ruleIds: ["duplicates"],
    line: (f) => [`  ${f.variable}  ${ui.dim(f.message)}`],
  },
  {
    heading: "Type mismatch",
    severity: "error",
    ruleIds: ["type-mismatch"],
    line: (f) => {
      const expected = /expected:\s*([a-z]+)/i.exec(f.message)?.[1];
      const found = /found:\s*([a-z]+)/i.exec(f.message)?.[1];
      const lines = [`  ${f.variable}`];
      if (expected) lines.push(`    ${ui.dim("expected:")} ${expected}`);
      if (found) lines.push(`    ${ui.dim("found:")} ${found}`);
      return lines;
    },
  },
  {
    heading: "Environment differences",
    severity: "warning",
    ruleIds: ["environment-diff"],
    line: (f) => [`  ${f.message}`],
  },
];

/**
 * Render a full audit report in the style of the envdoctor README example.
 * Returns the text; callers decide how to emit it.
 */
export function renderReport(audit: AuditResult, opts: ReportOptions): string {
  const lines: string[] = [];
  const title = "ENVIRONMENT AUDIT";
  lines.push(ui.title(title));
  lines.push(rule(title.length * 2));
  lines.push("");

  if (audit.findings.length === 0) {
    lines.push(`  ${ui.success("✓ No issues found")}`);
    lines.push("");
    lines.push(ui.dim(footer(audit)));
    return lines.join("\n");
  }

  for (const spec of SECTION_SPECS) {
    const group = audit.findings.filter((f) => spec.ruleIds.includes(f.ruleId));
    if (group.length === 0) continue;
    lines.push(ui.section(spec.heading));
    lines.push("");
    for (const finding of group) {
      lines.push(...spec.line(finding, opts.rootDir, opts.verbose));
    }
    lines.push("");
  }

  lines.push(ui.dim(footer(audit)));
  return lines.join("\n");
}

function footer(audit: AuditResult): string {
  const { summary } = audit;
  const parts = [
    `${summary.filesScanned} files scanned`,
    `${summary.variablesFound} variables`,
    summary.errors > 0 ? ui.error(`${summary.errors} error${plural(summary.errors)}`) : "0 errors",
    summary.warnings > 0
      ? ui.warning(`${summary.warnings} warning${plural(summary.warnings)}`)
      : "0 warnings",
  ];
  return `Summary: ${parts.join(" · ")}`;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}
