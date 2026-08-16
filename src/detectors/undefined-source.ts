import { makeFinding, type Detector } from "./detector.js";

/**
 * Undefined-in-source: a variable referenced as `process.env.X` /
 * `import.meta.env.X` in source code that is not defined in any environment
 * file and not documented in `.env.example`. These are the most dangerous
 * findings — code that will silently read `undefined` at runtime.
 */
export const undefinedSourceDetector: Detector = {
  id: "undefined-in-source",
  name: "undefined-in-source",
  description:
    "Used in source code but not defined in any environment file and not documented in .env.example.",
  detect(index) {
    const findings = [];
    const defined = new Set(index.envDefinitions.keys());
    // `.env.example` documents what *should* exist; it is not a runtime value,
    // so a source usage of an example-only variable is still a real finding.
    for (const [name, origins] of index.sourceUsages) {
      if (defined.has(name)) continue;
      findings.push(
        makeFinding(
          "undefined-in-source",
          "error",
          name,
          "used in source code but not defined in any environment file",
          origins,
        ),
      );
    }
    return findings;
  },
};
