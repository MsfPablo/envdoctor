import path from "node:path";
import { parse as parseYaml } from "yaml";
import { createVariable, mergeVariables } from "../models/environment-variable.js";
import type { EnvironmentVariable } from "../models/environment-variable.js";
import type { Origin } from "../models/origin.js";
import type { Parser } from "./parser.js";
import { lineForOffset, scanInterpolations } from "./yaml-interp.js";

const SECRET_REF_RE = /\$\{\{\s*(secrets|vars)\.([A-Za-z_][A-Za-z0-9_-]*)\s*\}\}/g;

/**
 * Parser for GitHub Actions workflow files (`.github/workflows/*.{yml,yaml}`).
 *
 * Definitions come from `env:` blocks at the workflow, job, and step level.
 * `${{ secrets.NAME }}` / `${{ vars.NAME }}` and `$VAR` / `${VAR}`
 * interpolations anywhere in the file become usages.
 */
export const githubActionsParser: Parser = {
  id: "github-actions",
  match(filePath) {
    const base = path.basename(filePath);
    const isWorkflow =
      filePath.includes(`${path.sep}.github${path.sep}workflows${path.sep}`) ||
      filePath.includes("/.github/workflows/");
    return isWorkflow && /\.(ya?ml)$/.test(base);
  },
  parse(content, filePath) {
    const doc = parseYaml(content) as unknown;
    const variables: EnvironmentVariable[] = [];
    collectEnvBlocks(doc, content, filePath, variables);

    const usages: EnvironmentVariable[] = [];

    // ${{ secrets.X }} / ${{ vars.X }} → usages.
    let match: RegExpExecArray | null;
    SECRET_REF_RE.lastIndex = 0;
    while ((match = SECRET_REF_RE.exec(content)) !== null) {
      const name = match[2];
      const subkind = match[1];
      if (name === undefined) continue;
      const origin: Origin = {
        filePath,
        line: lineForOffset(content, match.index),
        kind: "usage",
        format: "github-actions",
        subkind: subkind === "vars" ? "vars" : "secrets",
      };
      usages.push(createVariable(name, undefined, [origin]));
    }

    // $VAR / ${VAR} → usages.
    for (const interp of scanInterpolations(content)) {
      const origin: Origin = {
        filePath,
        line: interp.line,
        kind: "usage",
        format: "github-actions",
      };
      usages.push(createVariable(interp.name, undefined, [origin]));
    }

    return {
      filePath,
      format: "github-actions",
      variables: mergeVariables(variables),
      usages: mergeVariables(usages),
    };
  },
};

/** Recursively collect every `env:` block as definition variables. */
function collectEnvBlocks(
  node: unknown,
  content: string,
  filePath: string,
  out: EnvironmentVariable[],
): void {
  if (Array.isArray(node)) {
    for (const item of node) collectEnvBlocks(item, content, filePath, out);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  if ("env" in obj && obj.env && typeof obj.env === "object" && !Array.isArray(obj.env)) {
    for (const [key, rawValue] of Object.entries(obj.env as Record<string, unknown>)) {
      const value = rawValue === null || rawValue === undefined ? undefined : String(rawValue);
      const origin: Origin = {
        filePath,
        line: lineForName(content, key),
        kind: value === undefined ? "reference" : "definition",
        format: "github-actions",
      };
      out.push(createVariable(key, value, [origin]));
    }
  }

  for (const value of Object.values(obj)) {
    collectEnvBlocks(value, content, filePath, out);
  }
}

/** Best-effort line lookup for an `env:` key in the raw YAML text. */
function lineForName(content: string, name: string): number | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*["']?${escaped}["']?\\s*:`, "m");
  const match = re.exec(content);
  return match ? lineForOffset(content, match.index) : undefined;
}
