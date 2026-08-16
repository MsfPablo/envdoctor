import { inferType } from "../utils/type-infer.js";
import type { Origin } from "./origin.js";
import type { VariableType } from "./variable-type.js";

/**
 * A normalized view of one environment variable across every file in the
 * project. A single `EnvironmentVariable` aggregates every origin (definition,
 * reference, or usage) that mentions `name`.
 *
 * `value` is only ever set for definitions and is an implementation detail:
 * it is never rendered in CLI output and never written into generated files.
 */
export interface EnvironmentVariable {
  name: string;
  /** Raw value, present when at least one origin is a definition with a value. */
  value?: string;
  /** True when the name matches the secret heuristic. */
  isSecret: boolean;
  /** Inferred from `value` when available, else "unknown". */
  type: VariableType;
  /** Every place this name was observed. */
  origins: Origin[];
}

/** Convenience helpers for building and reading variables. */
export const isSecretName = (name: string): boolean =>
  /(SECRET|TOKEN|PASSWORD|PASS|API[_A-Z]*KEY|PRIVATE[_-]?KEY|CREDENTIALS)/i.test(
    name,
  );

/** Build a normalized variable from a name, optional value, and origins. */
export function createVariable(
  name: string,
  value: string | undefined,
  origins: Origin[],
): EnvironmentVariable {
  return {
    name,
    value,
    isSecret: isSecretName(name),
    type: inferType(value),
    origins,
  };
}

/**
 * Merge multiple variables with the same name into one, preserving every
 * origin and preferring the first non-empty value. Used by parsers to flatten
 * repeated references into a single variable.
 */
export function mergeVariables(variables: EnvironmentVariable[]): EnvironmentVariable[] {
  const byName = new Map<string, EnvironmentVariable>();
  for (const v of variables) {
    const existing = byName.get(v.name);
    if (!existing) {
      byName.set(v.name, { ...v, origins: [...v.origins] });
      continue;
    }
    existing.origins.push(...v.origins);
    if (existing.value === undefined && v.value !== undefined) {
      existing.value = v.value;
      existing.type = inferType(v.value);
    }
  }
  return Array.from(byName.values());
}
