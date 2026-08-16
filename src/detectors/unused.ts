import { makeFinding, type Detector } from "./detector.js";

/**
 * Unused: a variable defined in an environment file that is never referenced
 * anywhere — not in source code, not in docker-compose, not in GitHub Actions.
 * `.env.example` contents are documentation and are excluded here.
 */
export const unusedDetector: Detector = {
  id: "unused",
  name: "unused",
  description:
    "Defined in an environment file but never referenced in source, docker-compose, or GitHub Actions.",
  detect(index) {
    const findings = [];
    const used = new Set<string>(index.usages.keys());
    // A variable that is re-defined in compose/actions is, by definition, used.
    for (const name of index.composeDefinitions.keys()) used.add(name);
    for (const name of index.actionDefinitions.keys()) used.add(name);

    const seen = new Set<string>();
    for (const [name, defs] of index.envDefinitions) {
      if (seen.has(name)) continue;
      seen.add(name);
      if (used.has(name)) continue;
      findings.push(
        makeFinding(
          "unused",
          "warning",
          name,
          "defined but never referenced",
          defs.map((d) => d.origin),
        ),
      );
    }
    return findings;
  },
};
