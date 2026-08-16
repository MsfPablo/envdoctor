import type { Finding, AuditResult, Severity } from "../models/audit-result.js";
import { DETECTORS } from "../detectors/index.js";
import { displayPath, normalizePath } from "../utils/paths.js";

const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";

function severityToLevel(severity: Severity): "error" | "warning" | "note" {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "note";
}

function defaultLevelForDetector(ruleId: string): "error" | "warning" | "note" {
  const detector = DETECTORS.find((d) => d.id === ruleId);
  if (!detector) return "warning";
  // Default severities mirror the existing detector definitions.
  if (["missing", "undefined-in-source", "type-mismatch", "public-prefix"].includes(detector.id)) {
    return "error";
  }
  return "warning";
}

function renderRules() {
  return DETECTORS.map((d) => ({
    id: d.id,
    name: d.name,
    shortDescription: { text: d.description },
    defaultConfiguration: { level: defaultLevelForDetector(d.id) },
  }));
}

function renderLocation(rootDir: string, location: Finding["locations"][number]) {
  const physicalLocation: Record<string, unknown> = {
    artifactLocation: {
      uri: normalizePath(displayPath(rootDir, location.filePath)),
    },
  };
  if (location.line && location.line > 0) {
    physicalLocation.region = { startLine: location.line };
  }
  return { physicalLocation };
}

function renderResult(rootDir: string, finding: Finding) {
  return {
    ruleId: finding.ruleId,
    level: severityToLevel(finding.severity),
    message: { text: `${finding.variable}: ${finding.message}` },
    locations: finding.locations.map((loc) => renderLocation(rootDir, loc)),
  };
}

/** Format an audit result as SARIF 2.1.0 JSON. */
export function formatSarif(audit: AuditResult, rootDir: string): string {
  const sarif = {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "envdoctor",
            informationUri: "https://github.com/arun/envdoctor",
            rules: renderRules(),
          },
        },
        results: audit.findings.map((f) => renderResult(rootDir, f)),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}
