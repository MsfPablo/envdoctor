import type { VariableType } from "../models/variable-type.js";
import { makeFinding, type Detector } from "./detector.js";

/**
 * Type mismatch: the same variable is defined with values of incompatible
 * inferred types across environment files (e.g. `PORT=3000` in development
 * but `PORT=3000abc` in production). The "expected" type is taken from the
 * development file when present, otherwise the most common type. Only
 * variable *types* and locations are reported — never values.
 */
export const typeMismatchDetector: Detector = {
  id: "type-mismatch",
  name: "type-mismatch",
  description:
    "The same variable has incompatible inferred types across environment files.",
  detect(index) {
    const findings = [];
    for (const [name, defs] of index.envDefinitions) {
      const typed = defs.filter(
        (d) => d.value !== undefined && d.type !== "unknown" && d.value !== "",
      );
      if (typed.length < 2) continue;

      const distinctTypes = new Set(typed.map((d) => d.type));
      if (distinctTypes.size < 2) continue;

      const expected =
        typed.find((d) => d.environment === "development")?.type ??
        mostCommonType(typed);

      for (const def of typed) {
        if (def.type === expected) continue;
        findings.push(
          makeFinding(
            "type-mismatch",
            "error",
            name,
            `expected: ${expected}, found: ${def.type}`,
            [def.origin],
          ),
        );
      }
    }
    return findings;
  },
};

function mostCommonType(defs: { type: VariableType }[]): VariableType {
  const counts = new Map<VariableType, number>();
  for (const d of defs) counts.set(d.type, (counts.get(d.type) ?? 0) + 1);
  let best: VariableType = defs[0]!.type;
  let bestCount = -1;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}
