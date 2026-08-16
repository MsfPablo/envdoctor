import type { ProjectModel } from "../models/project-model.js";
import { makeFinding, type Detector } from "./detector.js";

/**
 * Environment differences: when a project has more than one environment file
 * (e.g. `.env` + `.env.production`), variables that exist in one environment
 * but not another are surfaced. The `diff` command uses `compareEnvironments`
 * for a focused two-environment comparison; the scan detector aggregates the
 * same comparison against a reference environment.
 *
 * Values are never compared — only whether a variable is present.
 */
export interface EnvDiffEntry {
  name: string;
  /** Present in both environments. */
  presentInBoth: boolean;
  presentInA: boolean;
  presentInB: boolean;
}

/** The set of variable names defined for a given environment label. */
export function variablesForEnvironment(model: ProjectModel, label: string): Set<string> {
  const names = new Set<string>();
  for (const file of model.envFiles) {
    if (file.environment === label) {
      for (const v of file.variables) names.add(v.name);
    }
  }
  return names;
}

/** Compare two environment labels, returning one entry per variable. */
export function compareEnvironments(
  model: ProjectModel,
  labelA: string,
  labelB: string,
): EnvDiffEntry[] {
  const a = variablesForEnvironment(model, labelA);
  const b = variablesForEnvironment(model, labelB);
  const all = new Set<string>([...a, ...b]);
  const entries: EnvDiffEntry[] = [];
  for (const name of all) {
    entries.push({
      name,
      presentInBoth: a.has(name) && b.has(name),
      presentInA: a.has(name),
      presentInB: b.has(name),
    });
  }
  entries.sort((x, y) => x.name.localeCompare(y.name));
  return entries;
}

export const environmentDiffDetector: Detector = {
  id: "environment-diff",
  name: "environment-diff",
  description:
    "A variable exists in one environment file but is missing from another.",
  detect(index) {
    const findings = [];
    const labels = index.envLabels;
    if (labels.length < 2) return [];
    const reference = labels.includes("development") ? "development" : labels[0]!;

    for (const other of labels) {
      if (other === reference) continue;
      for (const entry of compareEnvironments(index.model, reference, other)) {
        if (entry.presentInBoth) continue;
        const missingIn = entry.presentInA ? other : reference;
        findings.push(
          makeFinding(
            "environment-diff",
            "warning",
            entry.name,
            `${reference} → ${other} · ${entry.name} missing in ${missingIn}`,
            [],
          ),
        );
      }
    }
    return findings;
  },
};
