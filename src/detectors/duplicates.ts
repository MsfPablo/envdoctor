import type { Origin } from "../models/origin.js";
import { makeFinding, type Detector } from "./detector.js";

/**
 * Duplicates: the same variable defined more than once within a single file.
 * dotenv applies last-wins, so a repeated key is a silent override that
 * usually means a merge conflict or a copy-paste bug. (Distinct values across
 * *different* environment files are expected and not flagged here.)
 */
export const duplicatesDetector: Detector = {
  id: "duplicates",
  name: "duplicates",
  description: "The same variable is defined more than once in a single file.",
  detect(index) {
    const findings = [];
    for (const file of index.model.envFiles) {
      const byName = new Map<string, { origins: Origin[] }>();
      for (const v of file.variables) {
        const entry = byName.get(v.name) ?? { origins: [] };
        entry.origins.push(...v.origins);
        byName.set(v.name, entry);
      }
      for (const [name, entry] of byName) {
        if (entry.origins.length < 2) continue;
        const lines = entry.origins.map((o) => o.line).filter((l): l is number => l !== undefined);
        const where = lines.length > 0 ? `on lines ${lines.join(", ")}` : "in this file";
        findings.push(
          makeFinding(
            "duplicates",
            "error",
            name,
            `defined ${entry.origins.length} times ${where}`,
            entry.origins,
          ),
        );
      }
    }
    return findings;
  },
};
