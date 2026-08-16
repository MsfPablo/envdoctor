import type { Origin } from "../models/origin.js";
import { makeFinding, type Detector } from "./detector.js";

/**
 * Missing: a variable that is referenced (in docker-compose, GitHub Actions,
 * or `.env.example`) but defined in no environment file. Source-code
 * references are the concern of the `undefined-in-source` detector.
 */
export const missingDetector: Detector = {
  id: "missing",
  name: "missing",
  description:
    "Referenced in docker-compose, GitHub Actions, or .env.example but not defined in any environment file.",
  detect(index) {
    const findings = [];
    const defined = new Set(index.envDefinitions.keys());
    // Source usages are the undefined-in-source detector's job — skipping them
    // here avoids double-reporting a variable that is used in source code and
    // also referenced in compose/actions/.env.example.
    const sourceUsed = new Set(index.sourceUsages.keys());
    const referenced: { name: string; origins: Origin[] }[] = [];

    // Compose definitions that are NOT in any .env file are "missing" — they
    // rely on a runtime value that the project's env files don't provide.
    for (const [name, defs] of index.composeDefinitions) {
      if (!defined.has(name) && !sourceUsed.has(name)) {
        referenced.push({ name, origins: defs.map((d) => d.origin) });
      }
    }
    // GitHub Actions `env:` keys are workflow-internal (e.g. `CI: "true"`)
    // and secrets/vars live in repo settings — neither is expected in .env.
    for (const name of index.exampleNames) {
      if (!defined.has(name) && !sourceUsed.has(name)) {
        referenced.push({ name, origins: [] });
      }
    }

    // `${VAR}` interpolation in docker-compose means compose expects the
    // variable to exist. GitHub Actions `secrets.X`/`vars.X` references are
    // intentionally NOT checked here — those live in repo settings, not .env.
    for (const [name, origins] of index.usages) {
      const composeOrigins = origins.filter((o) => o.format === "docker-compose");
      if (composeOrigins.length === 0) continue;
      if (defined.has(name) || sourceUsed.has(name)) continue;
      referenced.push({ name, origins: composeOrigins });
    }

    const seen = new Set<string>();
    for (const ref of referenced) {
      if (seen.has(ref.name)) continue;
      seen.add(ref.name);
      findings.push(
        makeFinding(
          "missing",
          "error",
          ref.name,
          "referenced but not defined in any environment file",
          ref.origins,
        ),
      );
    }
    return findings;
  },
};
