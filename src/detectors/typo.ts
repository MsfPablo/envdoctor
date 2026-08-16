import { makeFinding, type Detector } from "./detector.js";

/**
 * Typo detector: pairs names that are referenced but not defined with names
 * that are defined but not referenced, and have a small edit distance.
 *
 * Example: `DATABSE_URL` referenced in compose but `DATABASE_URL` defined in
 * `.env` produces "did you mean DATABASE_URL?".
 */

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

function isLikelyTypo(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.length < 4 || b.length < 4) return false;
  const distance = levenshtein(a, b);
  const minLen = Math.min(a.length, b.length);
  // Distance of 1 is always flagged for names >= 4 chars.
  // Distance of 2 is flagged for names >= 6 chars.
  // Larger distances only when names are long and ratio is low.
  if (distance === 1) return true;
  if (distance === 2) return minLen >= 6;
  if (distance === 3) return minLen >= 10;
  return false;
}

export const typoDetector: Detector = {
  id: "typo",
  name: "typo",
  description:
    "A referenced variable name is very similar to a defined variable name and may be a typo.",
  detect(index) {
    const findings = [];

    const defined = new Set<string>(index.envDefinitions.keys());
    const used = new Set<string>([
      ...index.usages.keys(),
      ...index.composeDefinitions.keys(),
      ...index.actionDefinitions.keys(),
    ]);

    // Names referenced but not defined anywhere.
    const undefinedNames = [...used].filter((n) => !defined.has(n));
    // Names defined but never referenced anywhere.
    const unusedNames = [...defined].filter((n) => !used.has(n));

    const seen = new Set<string>();
    for (const undefinedName of undefinedNames) {
      for (const unusedName of unusedNames) {
        if (!isLikelyTypo(undefinedName, unusedName)) continue;
        const pairKey = [undefinedName, unusedName].sort().join("\0");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const origins = index.usages.get(undefinedName) ?? [];
        findings.push(
          makeFinding(
            "typo",
            "warning",
            undefinedName,
            `did you mean "${unusedName}"? (${undefinedName} is referenced but not defined, ${unusedName} is defined but unused)`,
            origins.slice(0, 3),
          ),
        );
      }
    }

    return findings;
  },
};
